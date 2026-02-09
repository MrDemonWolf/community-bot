"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import QRCode from "react-qr-code";

import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsContent() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Settings</h1>
      <div className="space-y-6">
        <ProfileSection session={session} />
        <Separator />
        <ChangePasswordSection />
        <Separator />
        <TwoFactorSection session={session} />
      </div>
    </div>
  );
}

function ProfileSection({ session }: { session: typeof authClient.$Infer.Session }) {
  const form = useForm({
    defaultValues: {
      name: session.user.name ?? "",
      username: (session.user as Record<string, unknown>).username as string ?? "",
    },
    onSubmit: async ({ value }) => {
      await authClient.updateUser(
        { name: value.name, username: value.username },
        {
          onSuccess: () => {
            toast.success("Profile updated");
          },
          onError: (error) => {
            toast.error(error.error.message || "Failed to update profile");
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Display name must be at least 2 characters"),
        username: z
          .string()
          .min(3, "Username must be at least 3 characters")
          .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
      }),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Display Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="username">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Username</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Subscribe>
            {(state) => (
              <Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
                {state.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordSection() {
  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.changePassword(
        {
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        },
        {
          onSuccess: () => {
            toast.success("Password changed successfully");
            form.reset();
          },
          onError: (error) => {
            toast.error(error.error.message || "Failed to change password");
          },
        },
      );
    },
    validators: {
      onSubmit: z
        .object({
          currentPassword: z.string().min(1, "Current password is required"),
          newPassword: z.string().min(8, "New password must be at least 8 characters"),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        }),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="currentPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Current Password</Label>
                <Input
                  id={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="newPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>New Password</Label>
                <Input
                  id={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Confirm New Password</Label>
                <Input
                  id={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Subscribe>
            {(state) => (
              <Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
                {state.isSubmitting ? "Changing..." : "Change Password"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFactorSection({ session }: { session: typeof authClient.$Infer.Session }) {
  const user = session.user as Record<string, unknown>;
  const twoFactorEnabled = !!user.twoFactorEnabled;

  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"password" | "qr" | "backup">("password");

  async function handleStartEnable() {
    setStep("password");
    setPassword("");
    setVerifyCode("");
    setTotpUri("");
    setBackupCodes([]);
    setShowEnableDialog(true);
  }

  async function handleEnableWithPassword() {
    setIsSubmitting(true);
    const res = await authClient.twoFactor.enable({
      password,
    });
    if (res.error) {
      toast.error(res.error.message || "Failed to enable 2FA");
      setIsSubmitting(false);
      return;
    }
    setTotpUri(res.data?.totpURI ?? "");
    setBackupCodes(res.data?.backupCodes ?? []);
    setStep("qr");
    setIsSubmitting(false);
  }

  async function handleVerifyTotp() {
    setIsSubmitting(true);
    const res = await authClient.twoFactor.verifyTotp({
      code: verifyCode,
    });
    if (res.error) {
      toast.error(res.error.message || "Invalid code");
      setIsSubmitting(false);
      return;
    }
    setStep("backup");
    setIsSubmitting(false);
    toast.success("Two-factor authentication enabled");
  }

  async function handleDisable() {
    setIsSubmitting(true);
    await authClient.twoFactor.disable(
      { password },
      {
        onSuccess: () => {
          toast.success("Two-factor authentication disabled");
          setShowDisableDialog(false);
          setPassword("");
        },
        onError: (error) => {
          toast.error(error.error.message || "Failed to disable 2FA");
        },
      },
    );
    setIsSubmitting(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Two-Factor Authentication</CardTitle>
            <Badge variant={twoFactorEnabled ? "default" : "secondary"}>
              {twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Add an extra layer of security to your account by requiring a
            verification code in addition to your password.
          </p>
          {twoFactorEnabled ? (
            <Button
              variant="destructive"
              onClick={() => {
                setPassword("");
                setShowDisableDialog(true);
              }}
            >
              Disable 2FA
            </Button>
          ) : (
            <Button onClick={handleStartEnable}>Enable 2FA</Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
          </DialogHeader>
          {step === "password" && (
            <div className="space-y-4">
              <DialogDescription>
                Enter your password to continue setting up 2FA.
              </DialogDescription>
              <div className="space-y-2">
                <Label htmlFor="2fa-password">Password</Label>
                <Input
                  id="2fa-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleEnableWithPassword}
                disabled={!password || isSubmitting}
              >
                {isSubmitting ? "Verifying..." : "Continue"}
              </Button>
            </div>
          )}
          {step === "qr" && (
            <div className="space-y-4">
              <DialogDescription>
                Scan this QR code with your authenticator app, then enter the
                verification code below.
              </DialogDescription>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCode value={totpUri} size={200} />
              </div>
              <div className="flex flex-col items-center space-y-4">
                <Label>Verification Code</Label>
                <InputOTP
                  maxLength={6}
                  value={verifyCode}
                  onChange={(value) => setVerifyCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  className="w-full"
                  onClick={handleVerifyTotp}
                  disabled={verifyCode.length !== 6 || isSubmitting}
                >
                  {isSubmitting ? "Verifying..." : "Verify & Enable"}
                </Button>
              </div>
            </div>
          )}
          {step === "backup" && (
            <div className="space-y-4">
              <DialogDescription>
                Save these backup codes in a safe place. You can use them to
                access your account if you lose your authenticator device.
              </DialogDescription>
              <div className="rounded-lg border bg-muted p-4">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((code) => (
                    <span key={code}>{code}</span>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => setShowEnableDialog(false)}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password to disable 2FA. This will make your account
              less secure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-2fa-password">Password</Label>
              <Input
                id="disable-2fa-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDisableDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDisable}
                disabled={!password || isSubmitting}
              >
                {isSubmitting ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
