/**
 * VoiceAgent — Frontend logic
 * Connects to LiveKit room, publishes user microphone, and displays live transcript.
 */

const { Room, RoomEvent, Track, createLocalAudioTrack } = LivekitClient;

// ── DOM Elements ──────────────────────────────────────────────
const orb            = document.getElementById('orb');
const statusBadge    = document.getElementById('status-badge');
const statusText     = document.getElementById('status-text');
const transcriptArea = document.getElementById('transcript-area');
const btnConnect     = document.getElementById('btn-connect');
const btnDisconnect  = document.getElementById('btn-disconnect');
const btnMute        = document.getElementById('btn-mute');

let room = null;
let localAudioTrack = null;
let isMuted = false;

// ── Set UI State ──────────────────────────────────────────────
function setStatus(state, text) {
    statusBadge.className = `status-badge ${state}`;
    statusText.textContent = text;
    orb.className = `orb ${state === 'connected' ? 'idle' : state}`;
}

function showConnected() {
    btnConnect.classList.add('hidden');
    btnDisconnect.classList.remove('hidden');
    btnMute.classList.remove('hidden');
}

function showDisconnected() {
    btnConnect.classList.remove('hidden');
    btnDisconnect.classList.add('hidden');
    btnMute.classList.add('hidden');
    setStatus('', 'Ready to connect');
    orb.className = 'orb idle';
}

// ── Add transcript line ───────────────────────────────────────
function addTranscript(role, text) {
    const line = document.createElement('div');
    line.className = `transcript-line ${role}`;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = role === 'user' ? 'You' : 'Agent';

    const content = document.createTextNode(text);

    line.appendChild(label);
    line.appendChild(content);
    transcriptArea.appendChild(line);
    transcriptArea.scrollTop = transcriptArea.scrollHeight;

    // Keep last 20 lines
    while (transcriptArea.children.length > 20) {
        transcriptArea.removeChild(transcriptArea.firstChild);
    }
}

// ── Connect to LiveKit room ───────────────────────────────────
async function connect() {
    try {
        setStatus('', 'Connecting...');
        btnConnect.disabled = true;

        // 1. Get token from our token server
        const resp = await fetch('/token?identity=user-' + Date.now());
        const { token, url, error } = await resp.json();

        if (error) {
            setStatus('error', error);
            btnConnect.disabled = false;
            return;
        }

        // 2. Create and connect to LiveKit room
        room = new Room({
            audioCaptureDefaults: {
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
            },
        });

        // ── Room event handlers ─────────────────────────────
        room.on(RoomEvent.Connected, () => {
            setStatus('connected', 'Connected — listening');
            showConnected();
        });

        room.on(RoomEvent.Disconnected, () => {
            showDisconnected();
            room = null;
        });

        // Handle agent's audio track
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (track.kind === Track.Kind.Audio) {
                const audioEl = track.attach();
                document.body.appendChild(audioEl);
                audioEl.style.display = 'none';
            }
        });

        // Handle agent state changes (speaking, listening, thinking)
        room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
            if (participant.identity?.startsWith('agent')) {
                const state = participant.attributes?.['lk.agent.state'];
                if (state === 'speaking') {
                    setStatus('speaking', 'Agent is speaking...');
                } else if (state === 'listening') {
                    setStatus('listening', 'Listening to you...');
                } else if (state === 'thinking') {
                    setStatus('connected', 'Thinking...');
                }
            }
        });

        // Handle transcription events
        room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
            for (const segment of segments) {
                if (segment.final && segment.text.trim()) {
                    const role = participant?.identity?.startsWith('agent') ? 'agent' : 'user';
                    addTranscript(role, segment.text.trim());
                }
            }
        });

        room.on(RoomEvent.RoomMetadataChanged, (metadata) => {
            // Room metadata updates
        });

        // 3. Connect to the room
        await room.connect(url, token);

        // 4. Publish user's microphone
        localAudioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        });

        await room.localParticipant.publishTrack(localAudioTrack);
        setStatus('connected', 'Connected — start speaking!');

    } catch (err) {
        console.error('Connection error:', err);
        setStatus('error', 'Connection failed: ' + err.message);
        showDisconnected();
    }

    btnConnect.disabled = false;
}

// ── Disconnect ────────────────────────────────────────────────
async function disconnect() {
    if (room) {
        await room.disconnect();
        room = null;
    }
    if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack = null;
    }
    showDisconnected();
    isMuted = false;
    btnMute.classList.remove('muted');
}

// ── Toggle Mute ───────────────────────────────────────────────
function toggleMute() {
    if (!localAudioTrack) return;

    isMuted = !isMuted;
    localAudioTrack.mute();

    if (isMuted) {
        localAudioTrack.mute();
        btnMute.classList.add('muted');
        btnMute.title = 'Unmute microphone';
    } else {
        localAudioTrack.unmute?.() || localAudioTrack.mute();
        btnMute.classList.remove('muted');
        btnMute.title = 'Mute microphone';
    }
}
