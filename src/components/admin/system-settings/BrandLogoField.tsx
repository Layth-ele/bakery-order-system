/**
 * Business logo picker for System Settings.
 *
 * Uploads to Firebase Storage (branding/) and puts the URL in the settings
 * form; it takes effect when the admin clicks Save, like every other field.
 * After saving, the onSettingsWritten Cloud Function publishes it to the
 * public business card, so the login page, headers and emails update.
 */
import { useRef, useState } from 'react';
import { ImageUp, RotateCcw } from 'lucide-react';
import { uploadBrandLogo, logoFileProblem, LOGO_TYPES } from '../../../services/firebase/storageService';

interface BrandLogoFieldProps {
  value: string;
  onChange: (url: string) => void;
}

export function BrandLogoField({ value, onChange }: BrandLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const problem = logoFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      setProgress(0);
      onChange(await uploadBrandLogo(file, setProgress));
    } catch (e) {
      setError((e as Error)?.message || 'Upload failed. Please try again.');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const uploading = progress !== null;

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <img
        src={value || '/app-icon.svg'}
        alt="Business logo preview"
        className="h-24 w-24 shrink-0 rounded-2xl border border-gray-200 bg-[#2c2416] object-contain p-1"
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-700">Business Logo</div>
        <p className="mt-1 text-xs text-gray-500">
          Shown on the login page, the app headers and emails. Square PNG, JPG or WebP, up to 2 MB
          (a transparent PNG looks best). Click <strong>Save</strong> to apply.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={LOGO_TYPES.join(',')}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#8B6F47] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a6140] disabled:opacity-60"
          >
            <ImageUp className="h-4 w-4" />
            {uploading ? `Uploading… ${progress}%` : value ? 'Replace logo' : 'Upload logo'}
          </button>
          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Use default
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
