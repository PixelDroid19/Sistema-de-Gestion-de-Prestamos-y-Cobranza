import { useCallback, useState } from 'react';
import { toast } from '../../lib/toast';
import type { SafeErrorContext } from '../../services/safeErrorMessages';

type SafeMutationOptions<TInput> = {
  action: (input: TInput) => Promise<unknown>;
  errorContext: SafeErrorContext;
  onSuccess?: () => void;
  successMessage?: string;
};

export const useSafeMutationAction = <TInput,>(options: SafeMutationOptions<TInput>) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(async (input: TInput): Promise<boolean> => {
    setIsSubmitting(true);

    try {
      await options.action(input);
      if (options.successMessage) {
        toast.success({ title: options.successMessage });
      }
      options.onSuccess?.();
      return true;
    } catch (error) {
      toast.apiErrorSafe(error, options.errorContext);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [options]);

  return {
    isSubmitting,
    run,
  };
};
