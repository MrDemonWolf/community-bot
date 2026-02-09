"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TwoFactorPage() {
  const router = useRouter();
  const [totpCode, setTotpCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  async function handleTotpVerify() {
    setIsSubmitting(true);
    await authClient.twoFactor.verifyTotp(
      { code: totpCode },
      {
        onSuccess: () => {
          router.push("/dashboard");
          toast.success("Signed in successfully");
        },
        onError: (error) => {
          toast.error(error.error.message || "Invalid code");
        },
      },
    );
    setIsSubmitting(false);
  }

  async function handleSendOtp() {
    await authClient.twoFactor.sendOtp(
      {},
      {
        onSuccess: () => {
          setOtpSent(true);
          toast.success("OTP sent to your email");
        },
        onError: (error) => {
          toast.error(error.error.message || "Failed to send OTP");
        },
      },
    );
  }

  async function handleOtpVerify() {
    setIsSubmitting(true);
    await authClient.twoFactor.verifyOtp(
      { code: otpCode },
      {
        onSuccess: () => {
          router.push("/dashboard");
          toast.success("Signed in successfully");
        },
        onError: (error) => {
          toast.error(error.error.message || "Invalid code");
        },
      },
    );
    setIsSubmitting(false);
  }

  async function handleBackupCodeVerify() {
    setIsSubmitting(true);
    await authClient.twoFactor.verifyBackupCode(
      { code: backupCode },
      {
        onSuccess: () => {
          router.push("/dashboard");
          toast.success("Signed in successfully");
        },
        onError: (error) => {
          toast.error(error.error.message || "Invalid backup code");
        },
      },
    );
    setIsSubmitting(false);
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your verification code to continue
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="totp">
            <TabsList className="w-full">
              <TabsTrigger value="totp" className="flex-1">
                Authenticator
              </TabsTrigger>
              <TabsTrigger value="otp" className="flex-1">
                Email OTP
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex-1">
                Backup Code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="totp" className="space-y-4 pt-4">
              <div className="flex flex-col items-center space-y-4">
                <Label>Enter code from your authenticator app</Label>
                <InputOTP
                  maxLength={6}
                  value={totpCode}
                  onChange={(value) => setTotpCode(value)}
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
                  onClick={handleTotpVerify}
                  disabled={totpCode.length !== 6 || isSubmitting}
                >
                  {isSubmitting ? "Verifying..." : "Verify"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="otp" className="space-y-4 pt-4">
              <div className="flex flex-col items-center space-y-4">
                {!otpSent ? (
                  <>
                    <p className="text-center text-sm text-muted-foreground">
                      We&apos;ll send a one-time code to your email address.
                    </p>
                    <Button className="w-full" onClick={handleSendOtp}>
                      Send Code
                    </Button>
                  </>
                ) : (
                  <>
                    <Label>Enter the code sent to your email</Label>
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(value) => setOtpCode(value)}
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
                      onClick={handleOtpVerify}
                      disabled={otpCode.length !== 6 || isSubmitting}
                    >
                      {isSubmitting ? "Verifying..." : "Verify"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSendOtp}
                    >
                      Resend code
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="backup" className="space-y-4 pt-4">
              <div className="space-y-4">
                <Label htmlFor="backup-code">Enter a backup code</Label>
                <Input
                  id="backup-code"
                  placeholder="Enter backup code"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={handleBackupCodeVerify}
                  disabled={!backupCode || isSubmitting}
                >
                  {isSubmitting ? "Verifying..." : "Verify"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
