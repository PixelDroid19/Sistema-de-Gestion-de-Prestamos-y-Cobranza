import { useSafeMutationAction } from './useSafeMutationAction';
import type { SafeErrorContext } from '../../services/safeErrorMessages';

type SubmitConfig<TInput> = {
  mutate: (input: TInput) => Promise<unknown>;
  errorContext: SafeErrorContext;
  onSuccess: () => void;
  successMessage?: string;
};

export const useCreateEntitySubmit = <TInput,>(config: SubmitConfig<TInput>) => {
  return useSafeMutationAction<TInput>({
    action: config.mutate,
    errorContext: config.errorContext,
    onSuccess: config.onSuccess,
    successMessage: config.successMessage,
  });
};
