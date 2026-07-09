import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Modal from "./Modal";

function cameraErrorMessage(e: unknown): string {
  const err = e as { name?: string; message?: string };
  switch (err?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera access was denied. Allow camera access in your browser settings, or type the ISBN by hand.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. You can type the ISBN instead.";
    case "NotReadableError":
      return "The camera is busy or unavailable (another app may be using it).";
    case "SecurityError":
      return "Camera access requires a secure (https) connection.";
    default:
      return "Couldn't start the camera. You can type the ISBN instead." +
        (err?.message ? ` (${err.message})` : "");
  }
}

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
  const [cameraError, setCameraError] = useState("");

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
      .catch((e) => {
        if (!stopped) setCameraError(cameraErrorMessage(e));
      });

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <Modal title="Scan a barcode" onClose={onClose}>
      <p className="muted">Point your camera at the book's barcode (the ISBN).</p>
      {cameraError ? (
        <div className="scanner-error" role="alert">
          <p>{cameraError}</p>
        </div>
      ) : (
        <video ref={videoRef} className="scanner-video" />
      )}
      <div className="row-end">
        <button className="btn" onClick={onClose}>
          {cameraError ? "Close" : "Cancel"}
        </button>
      </div>
    </Modal>
  );
}
