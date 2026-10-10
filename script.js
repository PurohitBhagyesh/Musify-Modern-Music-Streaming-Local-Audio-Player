/**
 * Musify - Modern Web Music Player
 * Complete Local Audio Management & Playback Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    songs: [],
    currentIndex: -1,
    isPlaying: false,
    activeFilter: 'all',
    searchQuery: '',
    audio: new Audio(),
  };

  const audioUpload = document.getElementById('audio-upload');
  const songListContainer = document.getElementById('song-list');
  const searchInput = document.getElementById('search-input');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const songCountBadge = document.getElementById('song-count');

  const playBtn = document.getElementById('play-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const muteBtn = document.getElementById('mute-btn');
  const seekBar = document.getElementById('seek-bar');
  const volumeBar = document.getElementById('volume-bar');
  const currentTimeEl = document.getElementById('current-time');
  const totalDurationEl = document.getElementById('total-duration');
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const albumArt = document.getElementById('player-album-art');

  const getSavedFavorites = () => {
    try {
      const saved = localStorage.getItem('musify_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load favorites from localStorage', e);
      return [];
    }
  };

  const saveFavorites = (favoriteNames) => {
    try {
      localStorage.setItem('musify_favorites', JSON.stringify(favoriteNames));
    } catch (e) {
      console.error('Failed to save favorites to localStorage', e);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const initListeners = () => {
    audioUpload.addEventListener('change', handleFileUpload);
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderSongList();
    });

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        renderSongList();
      });
    });

    playBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPreviousTrack);
    nextBtn.addEventListener('click', playNextTrack);

    state.audio.addEventListener('timeupdate', updateProgress);
    state.audio.addEventListener('ended', playNextTrack);
    state.audio.addEventListener('loadedmetadata', () => {
      totalDurationEl.textContent = formatTime(state.audio.duration);
    });
    state.audio.addEventListener('error', handleAudioError);

    seekBar.addEventListener('input', () => {
      if (state.audio.duration) {
        const seekTo = (seekBar.value / 100) * state.audio.duration;
        state.audio.currentTime = seekTo;
        currentTimeEl.textContent = formatTime(seekTo);
      }
    });

    volumeBar.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      setVolume(volume);
    });

    muteBtn.addEventListener('click', toggleMute);
    document.addEventListener('keydown', handleKeyboardShortcuts);
  };

  const handleAudioError = (e) => {
    console.error('Audio playback error encountered:', e);
    pauseAudio();
    playerTitle.textContent = 'Playback Error';
    playerArtist.textContent = 'Unable to play this file';
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const savedFavorites = getSavedFavorites();

    files.forEach((file) => {
      if (!file.type.startsWith('audio/')) return;

      const url = URL.createObjectURL(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const isFav = savedFavorites.includes(nameWithoutExt);

      state.songs.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        title: nameWithoutExt,
        artist: 'Local Track',
        url: url,
        file: file,
        isFavorite: isFav,
      });
    });

    // Reset file input so re-selecting the same file will trigger change event
    event.target.value = '';

    renderSongList();
    if (state.currentIndex === -1 && state.songs.length > 0) {
      loadTrack(0);
    }
  };

  const renderSongList = () => {
    const filteredSongs = state.songs.filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(state.searchQuery) ||
        song.artist.toLowerCase().includes(state.searchQuery);
      const matchesFilter =
        state.activeFilter === 'all' || (state.activeFilter === 'favorites' && song.isFavorite);

      return matchesSearch && matchesFilter;
    });

    songCountBadge.textContent = `${filteredSongs.length} track${filteredSongs.length !== 1 ? 's' : ''}`;

    if (filteredSongs.length === 0) {
      let emptyMessage = 'No audio files added yet. Upload local audio files to start listening!';
      if (state.songs.length > 0) {
        if (state.activeFilter === 'favorites') {
          emptyMessage = 'No favorite tracks yet. Click the heart icon to add favorites!';
        } else if (state.searchQuery) {
          emptyMessage = `No tracks matching "${state.searchQuery}".`;
        }
      }

      songListContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-music"></i>
          <p>${emptyMessage}</p>
        </div>
      `;
      return;
    }

    songListContainer.innerHTML = '';
    filteredSongs.forEach((song) => {
      const actualIndex = state.songs.findIndex((s) => s.id === song.id);
      const isActive = actualIndex === state.currentIndex;

      const itemEl = document.createElement('div');
      itemEl.className = `song-item ${isActive ? 'active' : ''}`;
      itemEl.innerHTML = `
        <div class="song-info">
          <div class="song-icon">
            <i class="fa-solid ${isActive && state.isPlaying ? 'fa-bars-staggered' : 'fa-music'}"></i>
          </div>
          <div class="song-details">
            <span class="song-name">${song.title}</span>
            <span class="song-artist">${song.artist}</span>
          </div>
        </div>
        <div class="song-actions">
          <button class="action-btn fav-btn ${song.isFavorite ? 'active' : ''}" title="Favorite">
            <i class="fa-${song.isFavorite ? 'solid' : 'regular'} fa-heart"></i>
          </button>
          <button class="action-btn delete-btn" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      itemEl.querySelector('.song-info').addEventListener('click', () => {
        if (actualIndex === state.currentIndex) {
          togglePlayPause();
        } else {
          loadTrack(actualIndex);
          playAudio();
        }
      });

      itemEl.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(song.id);
      });

      itemEl.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSong(song.id);
      });

      songListContainer.appendChild(itemEl);
    });
  };

  const loadTrack = (index) => {
    if (index < 0 || index >= state.songs.length) return;

    state.currentIndex = index;
    const song = state.songs[index];

    state.audio.src = song.url;
    playerTitle.textContent = song.title;
    playerArtist.textContent = song.artist;
    seekBar.value = 0;
    currentTimeEl.textContent = '0:00';

    renderSongList();
  };

  const togglePlayPause = () => {
    if (state.songs.length === 0) return;

    if (state.currentIndex === -1) {
      loadTrack(0);
    }

    if (state.isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  };

  const playAudio = () => {
    state.audio.play().then(() => {
      state.isPlaying = true;
      playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      playBtn.setAttribute('title', 'Pause');
      if (albumArt) albumArt.classList.add('playing');
      renderSongList();
    }).catch((err) => {
      console.error('Audio playback failed:', err);
    });
  };

  const pauseAudio = () => {
    state.audio.pause();
    state.isPlaying = false;
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    playBtn.setAttribute('title', 'Play');
    if (albumArt) albumArt.classList.remove('playing');
    renderSongList();
  };

  const playNextTrack = () => {
    if (state.songs.length === 0) return;
    const nextIndex = (state.currentIndex + 1) % state.songs.length;
    loadTrack(nextIndex);
    playAudio();
  };

  const playPreviousTrack = () => {
    if (state.songs.length === 0) return;
    const prevIndex = (state.currentIndex - 1 + state.songs.length) % state.songs.length;
    loadTrack(prevIndex);
    playAudio();
  };

  const updateProgress = () => {
    const { currentTime, duration } = state.audio;
    if (duration && !isNaN(duration)) {
      const progressPercent = (currentTime / duration) * 100;
      seekBar.value = progressPercent;
      currentTimeEl.textContent = formatTime(currentTime);
      totalDurationEl.textContent = formatTime(duration);
    }
  };

  const setVolume = (value) => {
    const volume = Math.max(0, Math.min(1, value));
    state.audio.volume = volume;
    volumeBar.value = Math.round(volume * 100);
    if (volume > 0 && state.audio.muted) {
      state.audio.muted = false;
    }
    updateVolumeIcon(volume);
  };

  const toggleMute = () => {
    if (state.audio.muted) {
      state.audio.muted = false;
      if (state.audio.volume === 0) {
        setVolume(0.5);
      } else {
        updateVolumeIcon(state.audio.volume);
      }
    } else {
      state.audio.muted = true;
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
  };

  const updateVolumeIcon = (volume) => {
    if (volume === 0 || state.audio.muted) {
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else if (volume < 0.5) {
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
    } else {
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
  };

  const toggleFavorite = (id) => {
    const song = state.songs.find((s) => s.id === id);
    if (song) {
      song.isFavorite = !song.isFavorite;
      const favs = state.songs.filter((s) => s.isFavorite).map((s) => s.title);
      saveFavorites(favs);
      renderSongList();
    }
  };

  const deleteSong = (id) => {
    const index = state.songs.findIndex((s) => s.id === id);
    if (index === -1) return;

    const [deletedSong] = state.songs.splice(index, 1);
    if (deletedSong && deletedSong.url) {
      URL.revokeObjectURL(deletedSong.url);
    }

    // Synchronize favorites in localStorage after track deletion
    const favs = state.songs.filter((s) => s.isFavorite).map((s) => s.title);
    saveFavorites(favs);

    const isCurrentPlaying = index === state.currentIndex;

    if (isCurrentPlaying) {
      pauseAudio();
      state.audio.src = '';
      playerTitle.textContent = 'No track selected';
      playerArtist.textContent = 'Select a song to play';
      state.currentIndex = -1;
      seekBar.value = 0;
      currentTimeEl.textContent = '0:00';
      totalDurationEl.textContent = '0:00';

      if (state.songs.length > 0) {
        const nextIdx = index < state.songs.length ? index : 0;
        loadTrack(nextIdx);
      }
    } else if (index < state.currentIndex) {
      state.currentIndex--;
    }

    renderSongList();
  };

  const handleKeyboardShortcuts = (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (state.audio.duration) {
          state.audio.currentTime = Math.min(state.audio.duration, state.audio.currentTime + 5);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (state.audio.duration) {
          state.audio.currentTime = Math.max(0, state.audio.currentTime - 5);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setVolume(state.audio.volume + 0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setVolume(state.audio.volume - 0.05);
        break;
      case 'KeyM':
        e.preventDefault();
        toggleMute();
        break;
      case 'KeyN':
        e.preventDefault();
        playNextTrack();
        break;
      case 'KeyP':
        e.preventDefault();
        playPreviousTrack();
        break;
    }
  };

  initListeners();
});
