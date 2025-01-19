document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const sendButton = document.getElementById('sendButton');
  const textInput = document.getElementById('textInput');
  const transcriptDiv = document.getElementById('transcript');
  let peerConn;
  let mediaStream;
  let clientSecret;

  startButton.addEventListener('click', async () => {
    try {
      console.log('Start button clicked');
      startButton.disabled = true;

      const tokenResponse = await fetch('/session');
      if (!tokenResponse.ok) {
        throw new Error(`HTTP error! Status: ${tokenResponse.status}`);
      }
      const { client_secret } = await tokenResponse.json();
      clientSecret = client_secret;
      console.log('Client secret received:', client_secret);

      peerConn = new RTCPeerConnection();

      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      peerConn.addTrack(mediaStream.getTracks()[0]);

      const channel = peerConn.createDataChannel('oai-events');
      channel.addEventListener('message', (e) => {
        const event = JSON.parse(e.data);
        console.log('Event received:', event);
        if (event.type === 'response.audio_transcript.done') {
          displayTranscript(`Bot: ${event.transcript}`);
        } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
          displayTranscript(`You: ${event.transcript}`);
        }
      });

      peerConn.ontrack = (event) => {
        console.log('Track received:', event);
        const audioEl = document.createElement('audio');
        audioEl.srcObject = event.streams[0];
        audioEl.play();
      };

      const offer = await peerConn.createOffer();
      console.log('SDP offer created:', offer);
      await peerConn.setLocalDescription(offer);

      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client_secret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error(`HTTP error! Status: ${sdpResponse.status}`);
      }

      const answer = { type: 'answer', sdp: await sdpResponse.text() };
      console.log('SDP answer received:', answer);
      await peerConn.setRemoteDescription(answer);

      stopButton.disabled = false;
      sendButton.disabled = false;
    } catch (error) {
      console.error('Error during initialization:', error);
      alert('An error occurred during initialization. Please check the console for details.');
      startButton.disabled = false;
    }
  });

  stopButton.addEventListener('click', () => {
    console.log('Stop button clicked');
    if (peerConn) {
      peerConn.close();
      peerConn = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    startButton.disabled = false;
    stopButton.disabled = true;
    sendButton.disabled = true;
  });

  sendButton.addEventListener('click', async () => {
    const text = textInput.value;
    if (text.trim() === '') return;

    displayTranscript(`You: ${text}`);
    textInput.value = '';

    try {
      const response = await fetch('/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      displayTranscript(`Bot: ${data.response}`);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  function displayTranscript(text) {
    const p = document.createElement('p');
    p.textContent = text;
    transcriptDiv.appendChild(p);
    transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
  }
});