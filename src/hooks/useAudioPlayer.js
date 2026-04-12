import { useEffect, useRef, useState } from 'react';

const FADE_DURATION_MS = 2200;
const FADE_OUT_BUFFER_SECONDS = 2.2;

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00';

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const useAudioPlayer = () => {
  const audioRef = useRef(null);
  const clipRef = useRef({ trackId: null, startTime: 0, endTime: null });
  const fadeFrameRef = useRef(null);
  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      setIsPlaying(false);
      setLoadingTrackId(null);
      setLoadingProgress(0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setLoadingTrackId(null);
      setLoadingProgress(0);
      setPlaybackTime(0);
    };
    const handleWaiting = () => {
      setLoadingTrackId(clipRef.current.trackId);
    };
    const handleCanPlay = () => {
      setLoadingTrackId(null);
      setLoadingProgress(100);

      const clipLength =
        clipRef.current.endTime != null
          ? clipRef.current.endTime - clipRef.current.startTime
          : Number.isFinite(audio.duration)
            ? Math.max(0, audio.duration - clipRef.current.startTime)
            : 0;

      setPlaybackDuration(clipLength);
    };
    const handleProgress = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.buffered.length === 0) return;

      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      const progress = Math.max(0, Math.min(100, Math.round((bufferedEnd / audio.duration) * 100)));
      setLoadingProgress(progress);
    };
    const handleTimeUpdate = () => {
      const { endTime } = clipRef.current;
      const effectiveEndTime =
        endTime != null
          ? endTime
          : Number.isFinite(audio.duration)
            ? audio.duration
            : null;

      setPlaybackTime(Math.max(0, audio.currentTime - clipRef.current.startTime));

      if (effectiveEndTime != null) {
        const fadeOutStart = Math.max(clipRef.current.startTime, effectiveEndTime - FADE_OUT_BUFFER_SECONDS);

        if (audio.currentTime >= fadeOutStart && audio.currentTime < effectiveEndTime) {
          const remainingSeconds = effectiveEndTime - audio.currentTime;
          audio.volume = Math.max(0, Math.min(1, remainingSeconds / FADE_OUT_BUFFER_SECONDS));
        }
      }

      if (endTime != null && audio.currentTime >= endTime) {
        audio.volume = 0;
        audio.pause();
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      if (fadeFrameRef.current) {
        window.cancelAnimationFrame(fadeFrameRef.current);
      }
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current = null;
    };
  }, []);

  const runFadeIn = () => {
    const audio = audioRef.current;

    if (!audio) return;

    if (fadeFrameRef.current) {
      window.cancelAnimationFrame(fadeFrameRef.current);
    }

    const start = window.performance.now();
    audio.volume = 0;

    const step = (now) => {
      const progress = Math.min((now - start) / FADE_DURATION_MS, 1);
      audio.volume = progress;

      if (progress < 1 && !audio.paused) {
        fadeFrameRef.current = window.requestAnimationFrame(step);
      } else {
        fadeFrameRef.current = null;
      }
    };

    fadeFrameRef.current = window.requestAnimationFrame(step);
  };

  const toggleTrack = async (track) => {
    const audio = audioRef.current;

    if (!audio || !track?.audioSrc) return;

    const isSameTrack = currentTrackId === track.id;
    const startTime = Number(track.previewStart ?? 0);
    const hasClipWindow = track.previewStart != null || track.previewDuration != null;
    const clipDuration = Number(track.previewDuration ?? 30);

    if (isSameTrack && !audio.paused) {
      audio.pause();
      return;
    }

    if (!isSameTrack) {
      audio.pause();
      audio.src = track.audioSrc;
      setCurrentTrackId(track.id);
      setLoadingProgress(0);
      setPlaybackTime(0);
      setPlaybackDuration(
        track.previewStart != null || track.previewDuration != null
          ? Number(track.previewDuration ?? 30)
          : 0
      );
      clipRef.current = {
        trackId: track.id,
        startTime,
        endTime: hasClipWindow ? startTime + clipDuration : null,
      };
    }

    setLoadingTrackId(track.id);

    if (!isSameTrack || Math.abs(audio.currentTime - startTime) > 0.5) {
      const setStartTime = () => {
        audio.currentTime = startTime;
      };

      if (audio.readyState >= 1) {
        setStartTime();
      } else {
        audio.addEventListener('loadedmetadata', setStartTime, { once: true });
      }
    }

    try {
      await audio.play();
      setLoadingTrackId(null);
      runFadeIn();
    } catch {
      setIsPlaying(false);
      setLoadingTrackId(null);
    }
  };

  const isTrackActive = (trackId) => currentTrackId === trackId && isPlaying;
  const isTrackLoading = (trackId) => loadingTrackId === trackId;
  const getTrackLoadingProgress = (trackId) => (loadingTrackId === trackId ? loadingProgress : 0);
  const getTrackProgress = (track) => {
    if (currentTrackId !== track.id || playbackDuration <= 0) return 0;

    return Math.max(0, Math.min(1, playbackTime / playbackDuration));
  };
  const getTrackTimeLabels = (track) => {
    const previewLength =
      track.previewStart != null || track.previewDuration != null
        ? Number(track.previewDuration ?? 30)
        : null;

    if (currentTrackId === track.id) {
      return {
        current: formatTime(playbackTime),
        total: playbackDuration > 0 ? formatTime(playbackDuration) : track.duration,
      };
    }

    return {
      current: previewLength != null ? '0:00' : '0:00',
      total: previewLength != null ? formatTime(previewLength) : track.duration,
    };
  };

  return {
    currentTrackId,
    isPlaying,
    loadingTrackId,
    toggleTrack,
    isTrackActive,
    isTrackLoading,
    getTrackLoadingProgress,
    getTrackProgress,
    getTrackTimeLabels,
  };
};

export default useAudioPlayer;
