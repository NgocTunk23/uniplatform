const sanitizeLocalRecording = (localRecording) => {
  if (!localRecording || typeof localRecording !== 'object') return null;

  return {
    status: localRecording.status || 'available',
    hasLocalFile: Boolean(localRecording.mixedPath || localRecording.hasLocalFile),
    trackCount: Array.isArray(localRecording.trackPaths)
      ? localRecording.trackPaths.length
      : Number(localRecording.trackCount || 0),
    createdAt: localRecording.createdAt || null,
    uploadedAt: localRecording.uploadedAt || null,
    uploadStartedAt: localRecording.uploadStartedAt || null,
    uploadFailedAt: localRecording.uploadFailedAt || null,
    uploadError: localRecording.uploadError || null,
  };
};

const sanitizeRecordingMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return metadata || null;
  const sanitizedLocalRecording = sanitizeLocalRecording(metadata.localRecording);

  return {
    ...metadata,
    ...(sanitizedLocalRecording ? { localRecording: sanitizedLocalRecording } : {}),
  };
};

module.exports = {
  sanitizeRecordingMetadata,
};
