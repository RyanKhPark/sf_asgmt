import { User as NextAuthUser } from "next-auth";

export interface AuthUser extends NextAuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  provider?: "google" | "credentials";
}

export interface SignUpData {
  name: string;
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "signin" | "signup";
}