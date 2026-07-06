import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

// A small modal that turns on the camera and reports the first barcode it reads.
// ISBNs are EAN-13 barcodes, which ZXing decodes out of the box.
export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !stopped) {
          stopped = true;
          onDetected(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        if (stopped) c.stop();
      })
      .catch(() => {
        /* camera unavailable — user can type the ISBN instead */
      });

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal scanner-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Scan a barcode</h2>
        <p className="muted">Point your camera at the book's barcode (the ISBN).</p>
        <video ref={videoRef} className="scanner-video" />
        <div className="row-end">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
