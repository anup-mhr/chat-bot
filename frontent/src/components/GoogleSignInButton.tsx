import { useEffect } from "react";

declare global {
  interface Window {
    google: any;
  }
}

const GoogleSignInButton: React.FC = () => {
  // Handle the callback when user signs in
  const handleCredentialResponse = (response: any) => {
    console.log("Encoded JWT ID token:", response.credential);
    // You can decode it using jwt-decode to get user info
    // const userInfo = jwt_decode(response.credential);
    // console.log(userInfo);
  };

  useEffect(() => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string, // 🔹 from your .env file
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInDiv"),
        {
          theme: "outline", // "filled_blue" also looks nice
          size: "large",
          text: "signin_with", // shows "G Sign in with Google"
          shape: "rectangular",
          logo_alignment: "left",
        }
      );
    }
  }, []);

  return <div id="googleSignInDiv"></div>;
};

export default GoogleSignInButton;
