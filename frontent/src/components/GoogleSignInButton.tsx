import { useEffect } from "react";
import { jwtDecode } from "jwt-decode";

interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

declare global {
  interface Window {
    google: any;
  }
}

interface GoogleProps {
  onSubmit: (name: string, email: string) => void;
}

const GoogleSignInButton: React.FC<GoogleProps> = ({ onSubmit }) => {
  const handleCredentialResponse = (response: any) => {
    const userInfo: GoogleUser = jwtDecode(response.credential);
    onSubmit(userInfo.name, userInfo.email);
  };

  useEffect(() => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
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
