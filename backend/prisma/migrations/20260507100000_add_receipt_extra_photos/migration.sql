-- Add extra photo URLs to Receipt (supplementary documents, not AI-processed)
ALTER TABLE "Receipt" ADD COLUMN "extraPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
