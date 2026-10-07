import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
});

export const newPasswordSchema = z
  .object({
    new_password: z.string().min(8, "Use at least 8 characters."),
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: "The passwords do not match.",
    path: ["confirm_password"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
