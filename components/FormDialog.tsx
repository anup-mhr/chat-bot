"use client";

import type React from "react";

import { useState } from "react";
import { Mail, User } from "lucide-react";
import "../src/FormDialog.css";

interface FormDialogProps {
  isOpen: boolean;
  onSubmit: (name: string, email: string) => void;
  onClose?: () => void;
  isForCall?: boolean;
  onCallRequest?: () => void;
}

export function FormDialog({
  isOpen,
  onSubmit,
  onClose,
  isForCall = false,
  onCallRequest,
}: FormDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({ name: "", email: "" });

  const validateForm = () => {
    const newErrors = { name: "", email: "" };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = "Name is required";
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(name, email);
      setName("");
      setEmail("");
      setErrors({ name: "", email: "" });

      // If this was for a call, trigger call after form submission
      if (isForCall && onCallRequest) {
        setTimeout(() => {
          onCallRequest();
        }, 500); // Small delay to let form close
      }
    }
  };

  const handleGoogleSignIn = () => {
    console.log("Google Sign In clicked");
    // Implement Google Sign In logic here
  };

  if (!isOpen) return null;

  return (
    <div className="entire-form">
      <div className="form-dialog-overlay">
        <div className="form-dialog-content">
          {/* Header with Bot Info */}
          <div className="flex justify-end">
            {onClose && (
              <button
                onClick={onClose}
                className="form-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>

          {/* Form Section */}
          <div className="form-section">
            <div className="form-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="form-logo-icon"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                <path d="M10 16.5l-3.5-3.5 1.41-1.41L10 13.67l5.09-5.09L16.5 10z" />
              </svg>
            </div>

            <h3 className="form-title">
              Please fill in your details to proceed:
            </h3>

            <form onSubmit={handleSubmit} className="form-fields">
              {/* Name Input */}
              <div className="form-input-group">
                <div className="form-input-wrapper">
                  <User size={18} className="form-input-icon" />
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`form-input ${
                      errors.name ? "form-input-error" : ""
                    }`}
                  />
                </div>
                {errors.name && (
                  <span className="form-error-text">{errors.name}</span>
                )}
              </div>

              {/* Email Input */}
              <div className="form-input-group">
                <div className="form-input-wrapper">
                  <Mail size={18} className="form-input-icon" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`form-input ${
                      errors.email ? "form-input-error" : ""
                    }`}
                  />
                </div>
                {errors.email && (
                  <span className="form-error-text">{errors.email}</span>
                )}
              </div>

              {/* Proceed Button */}
              <button type="submit" className="form-proceed-btn">
                Proceed
              </button>
            </form>

            {/* Divider */}
            <div className="form-divider">OR</div>

            {/* Google Sign In */}
            <button onClick={handleGoogleSignIn} className="form-google-btn">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="google-icon"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
