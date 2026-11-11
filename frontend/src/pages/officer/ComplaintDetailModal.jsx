import React, { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LeafletMap from '../../components/LeafletMap';
import AssignWorker from './AssignWorker';
import { resolveMediaUrl } from '../../utils/mediaUrl';

/**
 * ComplaintDetailModal:
 * Displays complete civic grievance details for Department Officers:
 * - Tracking ID, priority tier + score, ward, department category
 * - Citizen issue photos & worker camera resolution proof photos
 * - Interactive read-only Leaflet pinpoint map
 * - Citizen rating & written remarks (if verified/closed)
 * - Direct 'Assign / Reassign Worker' action backed by SQLite
 */
const ComplaintDetailModal = ({
  complaint,
  isOpen,
  onClose,
  onWorkerAssigned,
}) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  if (!isOpen || !complaint) return null;

  const citizenPhotos = (complaint.photos || (complaint.photo_url ? [complaint.photo_url] : [])).filter(Boolean);
  const proofPhotos = (complaint.proof_photos || (complaint.resolved_photo_url ? [complaint.resolved_photo_url] : [])).filter(Boolean);
  const workerName = complaint.worker_name && complaint.worker_name !== 'Unassigned'
    ? complaint.worker_name
    : complaint.assigned_to || 'Unassigned';
  const lat = complaint.latitude ?? complaint.location_lat ?? 21.1458;
  const lng = complaint.longitude ?? complaint.location_lng ?? 79.0882;

  const timelineSteps = [
    { status: 'Submitted', done: true, label: `By ${complaint.citizen_name || 'Citizen'}` },
    {
      status: 'Validated',
      done: ['Validated', 'Assigned', 'In-Progress', 'Work Done', 'Resolved', 'Closed'].includes(complaint.status),
      label: 'AI / Officer Approved',
    },
    {
      status: 'Assigned',
      done: ['Assigned', 'In-Progress', 'Work Done', 'Resolved', 'Closed'].includes(complaint.status),
      label: workerName !== 'Unassigned' ? workerName : 'Pending Dispatch',
    },
    {
      status: 'In-Progress',
      done: ['In-Progress', 'Work Done', 'Resolved', 'Closed'].includes(complaint.status),
      label: 'On-Site Repair',
    },
    {
      status: 'Closed',
      done: ['Work Done', 'Resolved', 'Closed'].includes(complaint.status),
      label: complaint.status === 'Closed' ? 'Citizen Verified' : 'Proof Submitted',
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-mono font-bold text-primary">
                #{complaint.tracking_id || complaint.id}
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {complaint.title || 'Civic Grievance Overview'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 leading-none"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={complaint.status} />
            <PriorityBadge level={complaint.priority_level || complaint.priority} />
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Score: {complaint.priority_score ?? 50}/100 &bull; SLA: {complaint.target_sla || '48h'}
            </span>
            <CategoryBadge category={complaint.category} />
            <WardBadge ward={complaint.ward_number || complaint.ward} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Citizen Reported Photos
              </h3>
              {citizenPhotos.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {citizenPhotos.map((url, i) => (
                    <img
                      key={i}
                      src={resolveMediaUrl(url, '')}
                      alt={`Citizen photo ${i + 1}`}
                      onClick={() => setSelectedPhoto(resolveMediaUrl(url, ''))}
                      className="w-28 h-24 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 shadow-xs"
                    />
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                  No citizen photo attached.
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Worker Camera Proof
              </h3>
              {proofPhotos.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {proofPhotos.map((url, i) => (
                    <img
                      key={i}
                      src={resolveMediaUrl(url, '')}
                      alt={`Resolution proof ${i + 1}`}
                      onClick={() => setSelectedPhoto(resolveMediaUrl(url, ''))}
                      className="w-28 h-24 rounded-xl object-cover border border-emerald-300 cursor-pointer hover:opacity-90 shadow-xs"
                    />
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                  Awaiting worker completion proof.
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description & Location
            </h3>
            <div className="text-sm text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <p className="leading-relaxed font-medium">{complaint.description || complaint.title}</p>
              {complaint.address && (
                <p className="text-xs text-slate-500 pt-1">📍 {complaint.address}</p>
              )}
              {complaint.repair_notes && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-1">
                  <strong>Worker Notes:</strong> {complaint.repair_notes}
                </p>
              )}
              {complaint.feedback && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1 italic">
                  <strong>
                    {complaint.rating
                      ? `Citizen Feedback (${complaint.rating}★):`
                      : 'Remarks / Status Note:'}
                  </strong>{' '}
                  &ldquo;{complaint.feedback}&rdquo;
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Grievance Location Map
            </h3>
            <LeafletMap
              lat={lat}
              lng={lng}
              category={complaint.category}
              readonly={true}
              showLegend={false}
              className="h-44 w-full rounded-2xl"
            />
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Status Lifecycle
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              {timelineSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border flex flex-col justify-between ${
                    step.done
                      ? 'bg-blue-50/70 border-primary text-primary font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="text-base mb-1">{step.done ? '✓' : '○'}</span>
                  <span className="text-[11px] leading-tight">{step.status}</span>
                  <span className="text-[9px] font-normal text-slate-500 mt-1 line-clamp-1">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-2">
            <div className="text-xs text-slate-500">
              Assigned Worker: <span className="font-bold text-slate-900">{workerName}</span>
            </div>

            <div className="flex items-center gap-2">
              {!['Work Done', 'Closed', 'Resolved', 'Rejected'].includes(complaint.status) && (
                <button
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  className="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  <span>👷‍♂️</span>
                  <span>{workerName !== 'Unassigned' ? 'Reassign Worker' : 'Assign Worker'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && (
        <AssignWorker
          complaint={complaint}
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onAssigned={(assignedName, updatedComp) => {
            if (onWorkerAssigned) {
              onWorkerAssigned(complaint.id, assignedName, updatedComp);
            }
          }}
        />
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-xl max-h-[85vh]">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-3 -right-3 bg-white text-slate-900 rounded-full h-8 w-8 flex items-center justify-center font-bold shadow-lg"
            >
              ✕
            </button>
            <img
              src={selectedPhoto}
              alt="Enlarged evidence"
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ComplaintDetailModal;
