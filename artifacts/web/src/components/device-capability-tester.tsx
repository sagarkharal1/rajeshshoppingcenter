import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Square, Upload, Video, Volume2 } from "lucide-react";

type Props = {
  lang: "en" | "ne";
};

const textMap = {
  en: {
    title: "Device test",
    description: "Use this panel to verify upload from device, live camera access, and microphone recording on this phone or laptop.",
    uploadTitle: "Upload from device",
    uploadHint: "Choose an image from the device gallery or files.",
    cameraTitle: "Live camera",
    cameraHint: "Open the real camera, then capture a test photo.",
    micTitle: "Microphone",
    micHint: "Record a short voice sample to confirm microphone permission and recording work.",
    chooseImage: "Choose image",
    startCamera: "Start camera",
    stopCamera: "Stop camera",
    capturePhoto: "Capture photo",
    startMic: "Start recording",
    stopMic: "Stop recording",
    uploadWorking: "Device upload is working.",
    cameraWorking: "Camera is working.",
    micWorking: "Microphone recording is working.",
    noImageYet: "No image selected yet.",
    noCaptureYet: "No camera photo captured yet.",
    noAudioYet: "No recording yet.",
    browserMissing: "This browser or device does not support this feature.",
    secureContext: "Camera and microphone need browser permission. They work best on localhost or HTTPS.",
    failedCamera: "Camera could not start.",
    failedMic: "Microphone could not start.",
  },
  ne: {
    title: "डिभाइस परीक्षण",
    description: "यो फोन वा ल्यापटपमा फाइल अपलोड, लाइभ क्यामेरा, र माइक्रोफोन रेकर्डिङ काम गरिरहेको छ कि छैन यहाँबाट जाँच्नुहोस्।",
    uploadTitle: "डिभाइसबाट अपलोड",
    uploadHint: "ग्यालेरी वा फाइलबाट तस्बिर छान्नुहोस्।",
    cameraTitle: "लाइभ क्यामेरा",
    cameraHint: "साँचो क्यामेरा खोल्नुहोस् र परीक्षण फोटो खिच्नुहोस्।",
    micTitle: "माइक्रोफोन",
    micHint: "माइक्रोफोन अनुमति र रेकर्डिङ काम गरिरहेको छ कि छैन जाँच्न छोटो आवाज रेकर्ड गर्नुहोस्।",
    chooseImage: "तस्बिर छान्नुहोस्",
    startCamera: "क्यामेरा खोल्नुहोस्",
    stopCamera: "क्यामेरा बन्द गर्नुहोस्",
    capturePhoto: "फोटो खिच्नुहोस्",
    startMic: "रेकर्ड सुरु गर्नुहोस्",
    stopMic: "रेकर्ड रोक्नुहोस्",
    uploadWorking: "डिभाइस अपलोड काम गरिरहेको छ।",
    cameraWorking: "क्यामेरा काम गरिरहेको छ।",
    micWorking: "माइक्रोफोन रेकर्डिङ काम गरिरहेको छ।",
    noImageYet: "अहिलेसम्म तस्बिर छानिएको छैन।",
    noCaptureYet: "अहिलेसम्म क्यामेराबाट फोटो खिचिएको छैन।",
    noAudioYet: "अहिलेसम्म रेकर्ड गरिएको छैन।",
    browserMissing: "यो ब्राउजर वा डिभाइसले यो सुविधा समर्थन गर्दैन।",
    secureContext: "क्यामेरा र माइक्रोफोनका लागि ब्राउजर अनुमति चाहिन्छ। localhost वा HTTPS मा राम्रोसँग काम गर्छ।",
    failedCamera: "क्यामेरा सुरु हुन सकेन।",
    failedMic: "माइक्रोफोन सुरु हुन सकेन।",
  },
} as const;

function TestCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="text-xl font-bold text-slate-950">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DeviceCapabilityTester({ lang }: Props) {
  const t = textMap[lang];
  const [uploadedImage, setUploadedImage] = useState("");
  const [cameraShot, setCameraShot] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [micError, setMicError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const stopMicStream = () => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopCamera();
      stopMicStream();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(String(reader.result || ""));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t.browserMissing);
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError(t.failedCamera);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCameraShot(canvas.toDataURL("image/png"));
  };

  const startMic = async () => {
    setMicError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError(t.browserMissing);
      return;
    }
    try {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl("");
      }
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stopMicStream();
      };
      recorder.start();
      setMicActive(true);
    } catch {
      setMicError(t.failedMic);
    }
  };

  const stopMic = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setMicActive(false);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(135deg,#fff9ef_0%,#f4ead8_100%)] p-5 shadow-sm">
        <h3 className="text-2xl font-bold text-slate-950">{t.title}</h3>
        <p className="mt-2 text-sm text-slate-600">{t.description}</p>
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          {t.secureContext}
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <TestCard title={t.uploadTitle} hint={t.uploadHint}>
          <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-700">
            <Upload className="h-4 w-4" />
            {t.chooseImage}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
          {uploadedImage ? (
            <>
              <p className="mt-3 text-sm font-semibold text-emerald-700">{t.uploadWorking}</p>
              <img src={uploadedImage} alt="Uploaded preview" className="mt-4 h-48 w-full rounded-2xl object-cover" />
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t.noImageYet}</p>
          )}
        </TestCard>

        <TestCard title={t.cameraTitle} hint={t.cameraHint}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startCamera} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
              <Camera className="h-4 w-4" />
              {t.startCamera}
            </button>
            <button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              <Square className="h-4 w-4" />
              {t.stopCamera}
            </button>
            <button type="button" onClick={capturePhoto} disabled={!cameraActive} className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60">
              <Video className="h-4 w-4" />
              {t.capturePhoto}
            </button>
          </div>
          <video ref={videoRef} muted playsInline className="mt-4 h-48 w-full rounded-2xl bg-slate-950 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {cameraError ? <p className="mt-3 text-sm font-semibold text-rose-600">{cameraError}</p> : null}
          {cameraShot ? (
            <>
              <p className="mt-3 text-sm font-semibold text-emerald-700">{t.cameraWorking}</p>
              <img src={cameraShot} alt="Camera capture" className="mt-4 h-48 w-full rounded-2xl object-cover" />
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t.noCaptureYet}</p>
          )}
        </TestCard>

        <TestCard title={t.micTitle} hint={t.micHint}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startMic} disabled={micActive} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
              <Mic className="h-4 w-4" />
              {t.startMic}
            </button>
            <button type="button" onClick={stopMic} disabled={!micActive} className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60">
              <Square className="h-4 w-4" />
              {t.stopMic}
            </button>
          </div>
          {micError ? <p className="mt-3 text-sm font-semibold text-rose-600">{micError}</p> : null}
          {audioUrl ? (
            <>
              <p className="mt-3 text-sm font-semibold text-emerald-700">{t.micWorking}</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-700">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Audio preview</span>
                </div>
                <audio controls src={audioUrl} className="w-full" />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t.noAudioYet}</p>
          )}
        </TestCard>
      </div>
    </div>
  );
}
