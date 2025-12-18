import { useState, useRef, useCallback } from "react";

export const useAudioRecorder = (
  sendAttachment: (audioBlob: Blob | null, file: File | null) => void
) => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [visualizeData, setVisualizeData] = useState<any>([]);
  const visualizationFrameIdRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      source.connect(analyser);

      const draw = () => {
        analyser.getByteTimeDomainData(dataArray);
        setVisualizeData(Array.from(dataArray));
        visualizationFrameIdRef.current = requestAnimationFrame(draw);
      };

      draw();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/wav" });
        sendAttachment(audioBlob, null);
        audioCtx.close();

        if (visualizationFrameIdRef.current) {
          cancelAnimationFrame(visualizationFrameIdRef.current);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error: any) {
      console.error(`Error accessing microphone: ${error}`);
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        alert(
          "Microphone access is blocked. Please enable it from your browser settings."
        );
      }
    }
  }, [sendAttachment]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  }, [mediaRecorder]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      const stream = mediaRecorder.stream;
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
      mediaRecorder.stop();

      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setMediaRecorder(null);
      setVisualizeData([]);

      if (visualizationFrameIdRef.current) {
        cancelAnimationFrame(visualizationFrameIdRef.current);
        visualizationFrameIdRef.current = null;
      }
    }
  }, [mediaRecorder]);

  return {
    isRecording,
    visualizeData,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
