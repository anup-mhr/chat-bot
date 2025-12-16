import type React from "react";

import { useRef, useState } from "react";
import { CircleX, Mail, User } from "lucide-react";
import { useVisitor } from "../context/org.context";
import GoogleSignInButton from "./GoogleSignInButton";

interface FormDialogProps {
  isOpen: boolean;
  onSubmit: (name: string, email: string) => void;
  isForCall?: boolean;
  onCallRequest?: () => void;
  formSubmit?: boolean;
}

export function FormDialog({
  isOpen,
  onSubmit,
  isForCall = false,
  onCallRequest,
  formSubmit,
}: FormDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({ name: "", email: "" });
  const { visitorData } = useVisitor();

  const nameRef = useRef<HTMLDivElement | null>(null);
  const emailRef = useRef<HTMLDivElement | null>(null);

  const validateForm = () => {
    const newErrors = { name: "", email: "" };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = "Name is required!!!";
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "Email Address is required!!!";
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email";
      isValid = false;
    }

    setErrors(newErrors);
    return { isValid, newErrors };
  };

  const triggerShake = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.classList.add("form-input-error", "shake");
      setTimeout(() => ref.current?.classList.remove("shake"), 500);
    }
  };

  const onFocusClear = (
    value: string,
    ref?: React.RefObject<HTMLDivElement>
  ) => {
    if (ref?.current) {
      ref.current.classList.remove("form-input-error");
      ref.current.classList.add("form-input-wrapper");
    }
    if (value === "name") setErrors((prev) => ({ ...prev, name: "" }));
    if (value === "email") setErrors((prev) => ({ ...prev, email: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid, newErrors } = validateForm();

    if (isValid) {
      onSubmit(name, email);
      setName("");
      setEmail("");
      setErrors({ name: "", email: "" });

      if (isForCall && onCallRequest) {
        setTimeout(() => onCallRequest(), 500);
      }
    } else {
      if (newErrors.name) triggerShake(nameRef as any);
      if (newErrors.email) triggerShake(emailRef as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="entire-form">
      <div className="form-dialog-overlay">
        <div className="form-dialog-content">
          {/* Header with Bot Info */}
          {/* <div className="flex justify-end">
            {onClose && (
              <button
                onClick={onClose}
                className="form-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div> */}

          {/* Form Section */}
          <div className="form-section">
            <div className="form-icon">
              <img
                className="relative flex h-14 w-14 shrink-0 overflow-hidden rounded-full"
                src={visitorData?.details?.bot_Logo || "/placeholder.svg"}
                alt="Bot Logo"
              />
            </div>

            <h3 className="form-title">
              Please fill in your details to proceed:
            </h3>

            <form onSubmit={handleSubmit} className="form-fields">
              {/* Name Input */}
              <div className="form-input-group">
                <div ref={nameRef} className={`form-input-wrapper`}>
                  {errors.name ? (
                    <CircleX size={18} className="form-input-icon-error" />
                  ) : (
                    <User size={18} className="form-input-icon" />
                  )}

                  <input
                    type="text"
                    placeholder={`${
                      errors.name ? errors.name : "Enter your name"
                    }`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => onFocusClear("name", nameRef as any)}
                    className="form-input"
                  />
                </div>
                {/* {errors.name && (
                  <span className="form-error-text">{errors.name}</span>
                )} */}
              </div>

              {/* Email Input */}
              <div className="form-input-group">
                <div ref={emailRef} className={`form-input-wrapper`}>
                  {errors.email ? (
                    <CircleX size={18} className="form-input-icon-error" />
                  ) : (
                    <Mail size={18} className="form-input-icon" />
                  )}
                  <input
                    type="email"
                    placeholder={`${
                      errors.email ? errors.email : "Enter your email"
                    }`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => onFocusClear("email", emailRef as any)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Proceed Button */}
              <div className="flex justify-center items-center">
                <button
                  type="submit"
                  className={`form-proceed-btn ${
                    formSubmit ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={formSubmit}
                >
                  {formSubmit ? "Loading..." : "Proceed"}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="form-divider">OR</div>

            {/* Google Sign In */}
            <div className="form-google-btn">
              <GoogleSignInButton onSubmit={onSubmit} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
