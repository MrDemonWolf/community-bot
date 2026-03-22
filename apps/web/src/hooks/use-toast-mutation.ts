import { toast } from "sonner";

/**
 * Wraps tRPC mutation options to automatically show toast notifications
 * on success and error, reducing boilerplate across dashboard pages.
 *
 * @example
 * const deleteMutation = useMutation(
 *   withToast(trpc.counter.delete.mutationOptions({
 *     onSuccess: () => { invalidateAll(); },
 *   }), "Counter deleted.")
 * );
 */
export function withToast<
  TOptions extends {
    onSuccess?: (...args: any[]) => any;
    onError?: (error: any, ...rest: any[]) => any;
  },
>(options: TOptions, successMessage: string): TOptions {
  return {
    ...options,
    onSuccess: (...args: any[]) => {
      toast.success(successMessage);
      return (options.onSuccess as any)?.(...args);
    },
    onError: (error: { message: string }, ...rest: any[]) => {
      toast.error(error.message);
      return (options.onError as any)?.(error, ...rest);
    },
  };
}
