import { useEffect, useState } from "react";
import { api, coverSrc } from "../api";
import type { CoverAsset } from "../api";
import { fileToResizedDataUrl } from "../utils/image";

/**
 * Cover selection for the book form: preview, photo upload (resized in the
 * browser), the saved-covers gallery from GET /api/covers, and clearing.
 */
export default function CoverPicker({
  coverUrl,
  coverData,
  title,
  onChange,
  onError,
}: {
  coverUrl: string;
  coverData: string | undefined;
  title: string;
  onChange: (patch: { cover_url?: string; cover_data?: string | undefined }) => void;
  onError: (message: string) => void;
}) {
  const [covers, setCovers] = useState<CoverAsset[]>([]);
  const [coversLoading, setCoversLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const preview = coverData || (coverUrl ? coverSrc(coverUrl) : "");

  useEffect(() => {
    let active = true;
    setCoversLoading(true);
    api
      .listCovers()
      .then((items) => {
        if (active) setCovers(items);
      })
      .catch(() => {
        if (active) setCovers([]);
      })
      .finally(() => {
        if (active) setCoversLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    try {
      const cover_data = await fileToResizedDataUrl(file);
      onChange({ cover_data });
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <>
      <div className="cover-upload">
        <div className="cover-upload-preview" aria-hidden="true">
          {preview ? (
            <img src={preview} alt="" />
          ) : (
            <div className="cover-placeholder">{title.slice(0, 1).toUpperCase() || "?"}</div>
          )}
        </div>
        <div className="cover-upload-controls">
          <button type="button" className="btn" onClick={() => setShowPicker((v) => !v)}>
            Choose saved cover
          </button>
          <label className="btn">
            Upload cover photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => chooseFile(e.target.files?.[0])}
            />
          </label>
          {preview && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onChange({ cover_data: undefined, cover_url: "" })}
            >
              Remove cover
            </button>
          )}
          <p className="muted small">
            Photos are saved in the server's <code>server/covers</code> folder.
          </p>
        </div>
      </div>
      {showPicker && (
        <div className="cover-picker">
          {coversLoading ? (
            <p className="muted small">Loading saved covers...</p>
          ) : covers.length === 0 ? (
            <p className="muted small">
              No saved covers found in <code>server/covers</code>.
            </p>
          ) : (
            <div className="cover-picker-grid">
              {covers.map((cover) => (
                <button
                  type="button"
                  key={cover.name}
                  className={
                    "cover-choice" + (coverUrl === cover.url ? " cover-choice-selected" : "")
                  }
                  onClick={() => {
                    onChange({ cover_data: undefined, cover_url: cover.url });
                    setShowPicker(false);
                  }}
                  title={cover.name}
                >
                  <img src={coverSrc(cover.url)} alt="" loading="lazy" />
                  <span>{cover.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
