const socket = io();
const statusText = document.getElementById('status');
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const connectBtn = document.getElementById('connectBtn');

let peerConnection;
let dataChannel;
let isInitiator = false;

// Variables for receiving files
let receiveBuffer = [];
let receivedSize = 0;
let incomingFileInfo = null;

// Free public STUN server provided by Google
const configuration = {
    'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]
};

// Initial connection to the signaling server
socket.on('connect', () => {
    console.log('Connected to server! ID:', socket.id);
    statusText.innerText = "🟢 Server Ready! Click 'Connect' button.";
    statusText.style.color = "green";
});

// Trigger WebRTC handshake on button click
connectBtn.addEventListener('click', () => {
    console.log("Connect button clicked! Sending connection signal...");
    socket.emit('signaling-message', { type: 'user-joined' });
    statusText.innerText = "⏳ Connecting...";
    statusText.style.color = "orange";
});

// Handle incoming signaling messages
socket.on('signaling-message', async (message) => {
    if (message.type === 'user-joined') {
        console.log("Peer is ready! Creating and sending Offer...");
        isInitiator = true;
        initializePeerConnection();
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signaling-message', { type: 'offer', offer: offer });
    } 
    else if (message.type === 'offer') {
        console.log("Offer received! Creating and sending Answer...");
        isInitiator = false;
        initializePeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signaling-message', { type: 'answer', answer: answer });
    } 
    else if (message.type === 'answer') {
        console.log("Answer received! Establishing connection...");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
    } 
    else if (message.type === 'candidate') {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
    }
});

// Setup the WebRTC Peer Connection
function initializePeerConnection() {
    if (peerConnection) return;
    
    peerConnection = new RTCPeerConnection(configuration);

    if (isInitiator) {
        dataChannel = peerConnection.createDataChannel('fileTransfer');
        setupDataChannel(dataChannel);
    }

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel(dataChannel);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signaling-message', { type: 'candidate', candidate: event.candidate });
        }
    };
}

// Handle Data Channel events (Receiving data)
function setupDataChannel(channel) {
    // Crucial: Set binary type for handling file buffers
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
        console.log("🚀 Direct P2P Connection Open!");
        statusText.innerText = "🚀 Direct Connection Established!";
        statusText.style.color = "blue";
    };

    channel.onmessage = (event) => {
        // Step 1: Catch Metadata (File Name & Size)
        if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            if (data.type === 'metadata') {
                incomingFileInfo = data;
                receiveBuffer = [];
                receivedSize = 0;
                console.log(`Receiving file: ${data.fileName}`);
                statusText.innerText = `📥 Receiving: ${data.fileName}...`;
                statusText.style.color = "orange";
            }
        } 
        // Step 2: Catch File Chunks (Binary Data)
        else {
            receiveBuffer.push(event.data);
            receivedSize += event.data.byteLength;

            // Step 3: Reassemble and Download when complete
            if (receivedSize === incomingFileInfo.fileSize) {
                console.log("File received completely!");
                statusText.innerText = "✅ File Received & Downloaded!";
                statusText.style.color = "green";
                downloadFile();
            }
        }
    };

    channel.onclose = () => {
        statusText.innerText = "🔴 Disconnected.";
        statusText.style.color = "red";
    };
}

// Function to trigger file download on the receiving end
function downloadFile() {
    const blob = new Blob(receiveBuffer);
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = incomingFileInfo.fileName;
    downloadLink.click(); // Auto-download
    
    // Clear buffer for the next transfer
    receiveBuffer = [];
    incomingFileInfo = null;
}

// FILE SENDING LOGIC (Triggered by Send button)
sendBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file first!");
        return;
    }

    if (!dataChannel || dataChannel.readyState !== 'open') {
        alert("Peers are not connected yet!");
        return;
    }

    console.log(`Sending file: ${file.name}`);
    statusText.innerText = `📤 Sending: ${file.name}...`;
    statusText.style.color = "orange";
    
    // Step 1: Send Metadata
    dataChannel.send(JSON.stringify({
        type: 'metadata',
        fileName: file.name,
        fileSize: file.size
    }));

    // Step 2: Read and send file in chunks (64KB)
    const chunkSize = 64 * 1024; 
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e) => {
        dataChannel.send(e.target.result);
        offset += e.target.result.byteLength;

        // If file is not fully read, keep reading the next slice
        if (offset < file.size) {
            readSlice(offset);
        } else {
            console.log("File sent successfully!");
            statusText.innerText = "✅ File Sent Successfully!";
            statusText.style.color = "green";
        }
    };

    const readSlice = (o) => {
        const slice = file.slice(offset, o + chunkSize);
        reader.readAsArrayBuffer(slice);
    };

    // Start reading the first slice
    readSlice(0);
})