import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getRoleSession } from '../../utils/authSession';
import WorkerLayout from '../../components/WorkerLayout';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LeafletMap from '../../components/LeafletMap';
import LoadingSpinner from '../../components/LoadingSpinner';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import { resolveMediaUrl } from '../../utils/mediaUrl';

// Mock task fallback for offline / demo mode
const MOCK_TASK_DETAIL = {
  id: 'CMP-20481',
  category: 'Roads & Infrastructure',
  ward: 2,
  priority: 'Critical',
  status: 'Assigned', // 'Assigned' | 'In-Progress' | 'Work Done' | 'Closed'
  description:
    'Deep cave-in and major pothole on 4th Main road crossing near the primary school gate. Water is getting accumulated causing risk to two-wheelers and pedestrians.',
  address: '4th Main Road Crossing, Near Primary School Gate, Ward 2',
  created_at: new Date(Date.now() - 3600 * 1000 * 3.5).toISOString(),
  assigned_at: new Date(Date.now() - 3600 * 1000 * 2.2).toISOString(),
  location_lat: 21.1458,
  location_lng: 79.0882,
  images: [
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800&auto=format&fit=crop&q=80',
  ],
  proof_photos: [],
  repair_notes: '',
};

// Calculate time elapsed since task assignment
const formatTimeElapsed = (assignedDate, createdDate) => {
  const targetDate = assignedDate || createdDate;
  if (!targetDate) return 'Assigned recently';

  const date = new Date(targetDate);
  const now = new Date();
  const diffMs = now - date;

  if (isNaN(diffMs) || diffMs < 0) return 'Just assigned';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h elapsed`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m elapsed`;
  }
  if (diffMins > 0) {
    return `${diffMins}m elapsed`;
  }
  return 'Just assigned';
};

const DEFAULT_FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80';

/**
 * ProofOfWorkModal component:
 * 1. Modal header: 'Upload Completion Proof' (Complaint #ID)
 * 2. Camera uploader: capture live photo of resolved site (Mandatory 1-2 photos)
 * 3. Repair Notes: Textarea for worker remarks (e.g., 'Pothole filled with cold mix bitumen')
 * 4. Action: POST to /api/v1/worker/tasks/:id/proof/ with multipart/form-data
 * 5. On success: close modal, update status pill to 'Work Done', show success toast
 */
export const ProofOfWorkModal = ({
  isOpen,
  onClose,
  taskId,
  trackingLabel,
  onSuccess,
}) => {
  const [photos, setPhotos] = useState([]); // [{ id, file, previewUrl }]
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [streamActive, setStreamActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');

  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Stop camera stream on unmount or close
  const stopLiveCamera = useCallback(() => {
    setCameraStream((prevStream) => {
      if (prevStream) {
        prevStream.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  // Attach active MediaStream after <video> mounts inside conditional viewfinder
  useEffect(() => {
    if (streamActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('[WorkerCamera] Video play interrupted:', err);
      });
    }
  }, [streamActive, cameraStream]);

  // Reset state when modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      setPhotos([]);
      setNotes('');
      setModalError('');
      setCameraError('');
      setSubmitting(false);
      setStreamActive(false);
    } else {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [isOpen, stopLiveCamera]);

  if (!isOpen) return null;

  // Start live WebRTC in-browser camera stream
  const startLiveCamera = async () => {
    setCameraError('');
    setModalError('');
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC camera not supported in this browser environment.');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      setCameraStream(stream);
      setStreamActive(true);
    } catch (err) {
      console.warn('Camera viewfinder init fallback:', err);
      setCameraError('Live webcam access blocked or unavailable. Please allow camera permission or use Device Rear Camera.');
      if (err?.name !== 'NotAllowedError' && err?.name !== 'PermissionDeniedError' && cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  // Capture frame from active live video feed
  const capturePhotoFromStream = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    if (width === 0 || height === 0) {
      setCameraError('Camera stream is still initializing. Please wait a moment and try again.');
      return;
    }
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `proof_cam_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleAddFiles([file]);
        stopLiveCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  // Handle image files addition
  const handleAddFiles = (fileList) => {
    setModalError('');
    if (!fileList || fileList.length === 0) return;

    const availableSlots = 2 - photos.length;
    if (availableSlots <= 0) {
      setModalError('Maximum 2 proof photos allowed.');
      return;
    }

    const newFiles = Array.from(fileList).slice(0, availableSlots);
    const mapped = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      sizeKb: Math.round(file.size / 1024),
    }));

    setPhotos((prev) => [...prev, ...mapped]);
  };

  const handleRemovePhoto = (photoId) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (target && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== photoId);
    });
    setModalError('');
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();

    // Mandatory: 1-2 photos
    if (photos.length === 0) {
      setModalError('Mandatory: Please attach at least 1 photo of the completed work.');
      return;
    }

    if (photos.length > 2) {
      setModalError('Please upload a maximum of 2 photos.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    const formData = new FormData();
    photos.forEach((item) => {
      formData.append('proof_photos', item.file);
    });
    formData.append('repair_notes', notes);
    formData.append('notes', notes);
    formData.append('status', 'Work Done');

    const createdPreviewUrls = photos.map((p) => p.previewUrl);

    try {
      // 4. Action: POST to /api/v1/worker/tasks/:id/proof/ with multipart/form-data
      const response = await api.post(`/v1/worker/tasks/${taskId}/proof/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const returnedPhotos =
        response?.data?.proof_photos || response?.data?.complaint?.proof_photos || createdPreviewUrls;

      // 5. On success callback
      if (onSuccess) {
        onSuccess({
          newStatus: 'Work Done',
          proofPhotos: returnedPhotos,
          notes,
        });
      }

      onClose();
    } catch (err) {
      const serverErr = err?.response?.data?.detail || err?.response?.data?.message;
      if (err?.response?.status === 401 || err?.response?.status === 403 || serverErr) {
        setModalError(serverErr || 'Could not submit proof. Please verify your Field Worker session.');
      } else {
        setModalError('Network error while uploading proof photo. Please retry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isUploadDisabled = photos.length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================
            1. MODAL HEADER: 'Upload Completion Proof' (Complaint #ID)
           ======================================================== */}
        <div className="px-5 py-4 border-b border-slate-200/90 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📸</span>
              <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                Upload Completion Proof
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500 font-medium">
                Complaint
              </span>
              <span className="font-mono font-bold text-xs text-primary bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                #{trackingLabel || taskId}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center text-sm font-bold transition"
            aria-label="Close proof upload modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmitProof} className="p-5 overflow-y-auto space-y-4">
          {/* Error Message */}
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-danger flex items-center gap-2">
              <span>⚠️</span>
              <span>{modalError}</span>
            </div>
          )}

          {/* ========================================================
              2. CAMERA UPLOADER: capture live photo of resolved site
                 (Mandatory 1-2 photos)
             ======================================================== */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                On-Site Resolution Photos <span className="text-danger">*</span>
              </label>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  photos.length >= 1
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {photos.length}/2 photos added
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Capture on-site resolution photos of the repaired/cleared infrastructure.
              <span className="font-semibold text-slate-700"> (Mandatory 1-2 live camera photos)</span>
            </p>

            {/* Strict Camera Security Banner */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
              <span className="text-sm">🔒</span>
              <span className="font-medium">
                <strong>Live Camera Only:</strong> Photo gallery uploads are strictly disabled to ensure authentic on-ground verification.
              </span>
            </div>

            {cameraError && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                {cameraError}
              </div>
            )}

            {/* Hidden canvas & camera input */}
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handleAddFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {/* LIVE WEBRTC VIEWFINDER STREAM */}
            {streamActive ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video flex items-center justify-center shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Viewfinder crosshairs */}
                <div className="absolute inset-0 pointer-events-none border border-white/20 m-6 rounded-lg flex items-center justify-center">
                  <div className="w-8 h-8 border-t-2 border-b-2 border-white/50" />
                </div>
                {/* Overlay controls */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-bold backdrop-blur-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhotoFromStream}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/40 flex items-center gap-1.5 transition active:scale-95"
                  >
                    <span>📸</span>
                    <span>Capture Photo</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Action Buttons for Live Photo Addition */
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* 1. Mobile Camera Snap Button */}
                <button
                  type="button"
                  disabled={isUploadDisabled}
                  onClick={() => cameraInputRef.current?.click()}
                  className={`py-3.5 px-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition text-center ${
                    isUploadDisabled
                      ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-50/70 hover:bg-blue-100 border-primary/50 hover:border-primary text-primary active:scale-98 cursor-pointer shadow-2xs'
                  }`}
                >
                  <span className="text-2xl">📱</span>
                  <span className="text-xs font-bold leading-tight">
                    Device Rear Camera
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Live capture only
                  </span>
                </button>

                {/* 2. Interactive Viewfinder Camera */}
                <button
                  type="button"
                  disabled={isUploadDisabled}
                  onClick={startLiveCamera}
                  className={`py-3.5 px-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition text-center ${
                    isUploadDisabled
                      ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-50/70 hover:bg-emerald-100 border-emerald-500/50 hover:border-emerald-600 text-emerald-800 active:scale-98 cursor-pointer shadow-2xs'
                  }`}
                >
                  <span className="text-2xl">🎥</span>
                  <span className="text-xs font-bold leading-tight">
                    Live Viewfinder
                  </span>
                  <span className="text-[10px] text-slate-500">
                    In-browser viewfinder
                  </span>
                </button>
              </div>
            )}

            {/* Photo Previews (1-2 thumbnails) */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {photos.map((item, index) => (
                  <div
                    key={item.id}
                    className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 group"
                  >
                    <img
                      src={item.previewUrl}
                      alt={`Proof thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Badge */}
                    <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                      Photo {index + 1}
                    </span>

                    {/* Remove Action */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(item.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xs font-bold shadow-md transition"
                      title="Remove this photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================
              3. REPAIR NOTES: Textarea for worker remarks
                 (e.g., 'Pothole filled with cold mix bitumen')
             ======================================================== */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="repair-notes"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Repair & Work Remarks
              </label>
              <span className="text-[11px] text-slate-400">
                {notes.length}/300
              </span>
            </div>

            <textarea
              id="repair-notes"
              rows={3}
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Pothole filled with cold mix bitumen, compacted and leveled with road surface."
              className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-slate-400 transition bg-slate-50/50 resize-none font-medium leading-relaxed"
            />
            <p className="text-[11px] text-slate-400">
              Provide brief technical notes regarding materials, equipment, or labor applied.
            </p>
          </div>

          {/* ========================================================
              SUBMIT & CANCEL ACTIONS
             ======================================================== */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="sm:w-1/3 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition text-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || photos.length === 0}
              className={`sm:w-2/3 py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                photos.length > 0 && !submitting
                  ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-amber-500/25 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Proof...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Submit Proof & Mark Done</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * TaskDetail component with GPS navigation and ProofOfWorkModal
 */
const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Proof upload modal visibility state
  const [showProofModal, setShowProofModal] = useState(false);

  // Zoomable photo modal state
  const [activePhoto, setActivePhoto] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const touchStartRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 1. Fetch: GET /api/v1/worker/tasks/:id/
  const fetchTask = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/v1/worker/tasks/${id}/`);
      const data = response?.data || {};
      setTask(data);
    } catch (err) {
      setTask(null);
      setError(err?.response?.data?.detail || 'Could not load task details. Please check your permissions or network.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Handle status update / accept task for 'In-Progress'
  const handleStartWork = async () => {
    setUpdating(true);
    setError('');
    setActionSuccess('');
    const workerSession = getRoleSession('worker');

    try {
      const res = await api.post(`/v1/worker/tasks/${id}/accept/`, {});
      const updatedTask = res?.data?.task || {};

      setTask((prev) => ({
        ...prev,
        ...updatedTask,
        status: 'In-Progress',
        is_claimed_by_me: true,
        can_accept: false,
        worker_name: workerSession?.user?.name || prev?.worker_name,
      }));
      setActionSuccess('Task claimed! Moved to In-Progress. You can now perform on-site repairs.');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not claim task. Please ensure you are signed in as the assigned ward worker.');
    } finally {
      setUpdating(false);
    }
  };

  // Proof-of-work submission callback from ProofOfWorkModal
  const handleProofSuccess = ({ newStatus, proofPhotos, notes }) => {
    setTask((prev) => ({
      ...prev,
      status: newStatus || 'Work Done',
      proof_photos: proofPhotos || prev?.proof_photos || [],
      repair_notes: notes || prev?.repair_notes || '',
    }));

    setActionSuccess('Resolution proof submitted successfully! Grievance status updated to Work Done.');
  };

  // Zoom controls for gallery modal
  const openZoomModal = (photoUrl) => {
    setActivePhoto(photoUrl);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const closeZoomModal = () => {
    setActivePhoto(null);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setZoomPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  // Pinch-to-zoom touch handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      touchStartRef.current = { dist, initialScale: zoomScale };
    } else if (e.touches.length === 1 && zoomScale > 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - zoomPosition.x,
        y: e.touches[0].clientY - zoomPosition.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      const scaleDelta = currentDist / touchStartRef.current.dist;
      const newScale = Math.min(
        Math.max(touchStartRef.current.initialScale * scaleDelta, 1),
        4
      );
      setZoomScale(newScale);
    } else if (e.touches.length === 1 && isDraggingRef.current && zoomScale > 1) {
      setZoomPosition({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  if (loading) {
    return (
      <WorkerLayout activeBottomTab="tasks">
        <div className="px-4 py-8 max-w-2xl mx-auto">
          <LoadingSkeleton
            variant="detail"
            message="Loading task details & GPS coordinates..."
          />
        </div>
      </WorkerLayout>
    );
  }

  if (!task) {
    return (
      <WorkerLayout activeBottomTab="tasks">
        <div className="p-6 max-w-md mx-auto text-center space-y-3">
          {error ? <ErrorMessage message={error} onRetry={fetchTask} /> : <p className="text-sm font-bold text-danger">Task not found.</p>}
          <button
            type="button"
            onClick={() => navigate('/worker')}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
          >
            Back to Assigned Tasks
          </button>
        </div>
      </WorkerLayout>
    );
  }

  const currentStatus = task.status || 'Assigned';
  const complaintPhotos = task.images || task.photos || [];
  const proofPhotos = task.proof_photos || [];
  const taskLat = Number(
    task.latitude ??
    task.lat ??
    task.location_lat ??
    21.1458
  );
  const taskLng = Number(
    task.longitude ??
    task.lng ??
    task.location_lng ??
    79.0882
  );
  const taskAddress =
    task.address ||
    task.location_address ||
    'Nagpur, Maharashtra';

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${taskLat},${taskLng}`;

  const timeElapsed = formatTimeElapsed(
    task.assigned_at,
    task.created_at || task.submitted_at
  );

  return (
    <WorkerLayout activeBottomTab="tasks">
      <div className="px-4 pt-4 sm:pt-6 pb-28 sm:pb-32 space-y-4 max-w-2xl mx-auto">
        {/* ========================================================
            2. HEADER BAR
            - Back button
            - Complaint ID
            - PriorityBadge
            - WardBadge
            - Time elapsed since assignment
           ======================================================== */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/worker')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 py-1.5 px-3 rounded-xl transition"
              title="Return to tasks list"
            >
              <span>←</span>
              <span>All Tasks</span>
            </button>

            {/* Time elapsed since assignment */}
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-2xs">
              <span className="text-xs">⏱️</span>
              <span>{timeElapsed}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm sm:text-base text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                #{task.tracking_id || task.id || id}
              </span>
              <PriorityBadge level={task.priority} />
            </div>

            <div className="flex items-center gap-2">
              <CategoryBadge category={task.category} />
              <WardBadge ward={task.ward} />
            </div>
          </div>
        </div>

        {/* Success Alert Banner */}
        {actionSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold shadow-2xs animate-in fade-in duration-200">
            <span className="text-base">✅</span>
            <span className="flex-1">{actionSuccess}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && <ErrorMessage message={error} onRetry={fetchTask} />}

        {/* Current Status Overview */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Status:</span>
            <StatusBadge status={currentStatus} />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Assigned to Field Response
          </span>
        </div>

        {/* Issue Description */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Citizen Grievance Description
          </h2>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            {task.description || 'No detailed description provided.'}
          </p>
        </div>

        {/* ========================================================
            3. LOCATION MAP WITH GPS NAVIGATION
            - Leaflet map container showing pin
            - Address
            - 'Open in Google Maps' external link
           ======================================================== */}
        <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-base text-red-500">📍</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Grievance GPS Location
              </h2>
            </div>

            {/* 'Open in Google Maps' External Navigation Link */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white bg-blue-50 hover:bg-primary active:bg-blue-700 px-3 py-1.5 rounded-xl border border-blue-200 hover:border-primary transition shadow-2xs"
              title="Open turn-by-turn directions in Google Maps"
            >
              <span>🧭 Open in Google Maps</span>
              <span className="text-xs">↗</span>
            </a>
          </div>

          {/* Prominent Address display */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 flex items-start gap-2">
            <span className="font-bold text-slate-900 whitespace-nowrap">
              Address:
            </span>
            <span className="font-semibold text-slate-800 leading-snug">
              {taskAddress}
            </span>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-inner">
            <LeafletMap
              lat={taskLat}
              lng={taskLng}
              category={task?.category || task?.dept}
              readonly={true}
              className="h-64 sm:h-72 w-full"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
            <span>Lat: {taskLat.toFixed(5)}</span>
            <span>Lng: {taskLng.toFixed(5)}</span>
          </div>
        </section>

        {/* ========================================================
            4. ISSUE PHOTOS GALLERY (WITH PINCH-TO-ZOOM)
            - Citizen uploaded photos gallery
            - Interactive zoom modal with pinch & touch zoom controls
           ======================================================== */}
        <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>📸</span>
              <span>Citizen Issue Photos</span>
            </h2>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {complaintPhotos.length} photo{complaintPhotos.length !== 1 ? 's' : ''}
            </span>
          </div>

          {complaintPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {complaintPhotos.map((photoUrl, idx) => {
                const resolved = resolveMediaUrl(photoUrl);
                return (
                  <div
                    key={idx}
                    onClick={() => openZoomModal(resolved)}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-2xs cursor-pointer bg-slate-100 hover:shadow-md transition"
                  >
                    <img
                      src={resolved}
                      alt={`Citizen grievance site evidence #${idx + 1}`}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2 text-center">
                    <span className="text-lg">🔍</span>
                    <span className="text-[11px] font-bold mt-1">
                      Pinch / Tap to Zoom
                    </span>
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                    Photo {idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
          ) : (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              No photos attached by citizen for this report.
            </div>
          )}
        </section>

        {/* ========================================================
            5. ACTION BUTTONS (STATUS-DRIVEN)
            - If status == 'Assigned': Blue 'Start Work' button
            - If status == 'In-Progress': Amber 'Upload Proof & Complete' CTA -> opens ProofOfWorkModal
            - Work Done & Closed states
           ======================================================== */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Field Actions
          </h2>

          {/* STATUS: ASSIGNED / VALIDATED / SUBMITTED -> 'Accept Task & Begin Work' button */}
          {['Assigned', 'Validated', 'Submitted', 'Pending', 'New'].includes(currentStatus) && task.can_accept !== false && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                This grievance is active in your designated municipal ward and department sector. Accept work to claim it and head to the reported coordinates.
              </p>
              <button
                type="button"
                onClick={handleStartWork}
                disabled={updating}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-xl shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {updating ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Claiming task...</span>
                  </>
                ) : (
                  <>
                    <span className="text-base">⚡</span>
                    <span>Accept Task & Begin Work</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STATUS: IN-PROGRESS -> Amber 'Upload Proof & Complete' CTA */}
          {currentStatus === 'In-Progress' && (
            <div className="space-y-4">
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <span className="text-base leading-none">⚠️</span>
                <div>
                  <span className="font-bold">Work is ongoing on-site. </span>
                  When resolution is completed, take 1-2 live photos of the repaired
                  site and submit completion remarks.
                </div>
              </div>

              {/* Amber 'Upload Proof & Complete' CTA button */}
              <button
                type="button"
                onClick={() => setShowProofModal(true)}
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-sm rounded-xl shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-101"
              >
                <span className="text-base">📸</span>
                <span>Upload Proof & Complete</span>
              </button>
            </div>
          )}

          {/* STATUS: WORK DONE */}
          {currentStatus === 'Work Done' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-center space-y-1">
                <div className="text-2xl">⏳</div>
                <h3 className="font-bold text-purple-700 text-sm">
                  Work Done • Awaiting Verification
                </h3>
                <p className="text-xs text-slate-600">
                  Your resolution has been recorded. The Ward Officer and Citizen
                  will review your proof photos and remarks.
                </p>
              </div>

              {/* Worker Remarks if available */}
              {task.repair_notes && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Worker Resolution Remarks:
                  </span>
                  <p className="text-xs font-semibold text-slate-800 italic">
                    "{task.repair_notes}"
                  </p>
                </div>
              )}

              {/* Submitted Proof Photos */}
              {proofPhotos.length > 0 && (
                <div className="pt-1 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Submitted Proof Photos
                  </h4>
                  <div className="flex gap-2.5 overflow-x-auto pb-2">
                    {proofPhotos.map((photoUrl, idx) => {
                      const resolvedProof = resolveMediaUrl(photoUrl);
                      return (
                      <div
                        key={idx}
                        onClick={() => openZoomModal(resolvedProof)}
                        className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-slate-200 shadow-2xs cursor-pointer relative bg-slate-100"
                      >
                        <img
                          src={resolvedProof}
                          alt={`Proof evidence #${idx + 1}`}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.style.display = 'none';
                          }}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Proof #{idx + 1}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATUS: CLOSED */}
          {currentStatus === 'Closed' && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1.5">
              <div className="text-3xl">🎉</div>
              <h3 className="font-bold text-emerald-800 text-sm">
                Grievance Closed & Verified
              </h3>
              <p className="text-xs text-slate-600">
                This municipal ticket has been successfully validated, inspected,
                and closed.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ========================================================
          PROOF-OF-WORK UPLOAD MODAL
         ======================================================== */}
      <ProofOfWorkModal
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
        taskId={task.id || id}
        trackingLabel={task.tracking_id || task.id || id}
        onSuccess={handleProofSuccess}
      />

      {/* ========================================================
          FULLSCREEN PHOTO VIEWER MODAL WITH PINCH-TO-ZOOM
         ======================================================== */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 select-none animate-in fade-in duration-150"
          onClick={closeZoomModal}
        >
          {/* Top Controls Bar */}
          <div
            className="flex items-center justify-between z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white text-xs font-bold">
              <span>Zoom: {Math.round(zoomScale * 100)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-lg transition"
                title="Zoom in (+)"
              >
                +
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-lg transition"
                title="Zoom out (-)"
              >
                −
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-xs transition"
                title="Reset zoom"
              >
                ↺
              </button>
              <button
                type="button"
                onClick={closeZoomModal}
                className="w-9 h-9 rounded-full bg-white/30 hover:bg-white/40 text-white flex items-center justify-center font-bold text-base transition ml-2"
                title="Close viewer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Interactive Zoom & Pan Image Canvas */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden touch-none my-2 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={activePhoto}
              alt="Enlarged issue evidence with pinch-to-zoom"
              style={{
                transform: `scale(${zoomScale}) translate(${zoomPosition.x / zoomScale}px, ${zoomPosition.y / zoomScale}px)`,
                transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out',
                maxWidth: '90vw',
                maxHeight: '75vh',
              }}
              className="object-contain rounded-lg shadow-2xl pointer-events-auto"
              draggable={false}
            />
          </div>

          {/* Helper caption */}
          <div
            className="text-center text-white/70 text-xs py-1"
            onClick={(e) => e.stopPropagation()}
          >
            Pinch with two fingers or use + / − buttons to zoom in/out. Drag to pan.
          </div>
        </div>
      )}
    </WorkerLayout>
  );
};

export default TaskDetail;
