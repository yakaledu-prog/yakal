import { useState, useRef, useEffect } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string) => void;
  className?: string;
}

export function ImageUpload({ value, onChange, className }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImageLoaded(false);
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configuration missing in .env");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await res.json();
      onChange(data.secure_url);
    } catch (err) {
      console.error(err);
      alert("Error uploading image. Make sure VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET are set.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className={cn("relative rounded-xl border-2 border-dashed border-[#e9edef] dark:border-[#2a3942] bg-gray-50 dark:bg-[#182329] overflow-hidden flex flex-col items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-[#202c33]", className)}>
      {value ? (
        <>
          {!imageLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#182329] z-0">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mb-2" />
              <span className="text-[12px] text-muted-foreground">Loading image...</span>
            </div>
          )}
          <img 
            src={value} 
            alt="Uploaded preview" 
            onLoad={() => setImageLoaded(true)}
            className={cn(
              "w-full h-full object-cover relative z-10 transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )} 
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-white/20 hover:bg-white/30 ease-in-out text-white rounded-full transition-colors"
            >
              <Upload size={20} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-2 bg-red-500/50 hover:bg-red-500/70 ease-in-out text-white rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-full flex flex-col items-center justify-center p-6 text-muted-foreground hover:text-[#1099A1] transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 mb-2 animate-spin text-[#1099A1]" />
              <span className="text-[13px] font-medium text-[#111] dark:text-white">Uploading...</span>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-[#1099A1]/10 flex items-center justify-center mb-3">
                <ImageIcon className="w-6 h-6 text-[#1099A1]" />
              </div>
              <span className="text-[14px] font-semibold text-[#111] dark:text-white mb-1">Click to upload</span>
              <span className="text-[12px]">SVG, PNG, JPG or GIF (max. 5MB)</span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </div>
  );
}
