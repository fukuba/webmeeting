const Peer = window.Peer;

(async function main() {
    const localVideo = document.getElementById('js-local-stream');
    const joinTrigger = document.getElementById('js-join-trigger');
    const leaveTrigger = document.getElementById('js-leave-trigger');
    const remoteVideos = document.getElementById('js-remote-streams');
    const roomId = document.getElementById('js-room-id');
    const roomMode = document.getElementById('js-room-mode');
    const localText = document.getElementById('js-local-text');
    const sendTrigger = document.getElementById('js-send-trigger');
    const messages = document.getElementById('js-messages');
    const meta = document.getElementById('js-meta');
    const sdkSrc = document.querySelector('script[src*=skyway]');
    const sharescreenVideo = document.getElementById('js-sharescreen-stream');
    const sharescreenTrigger = document.getElementById('js-sharescreen-trigger');

    meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

    const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

    roomMode.textContent = getRoomModeByHash();
    window.addEventListener(
        'hashchange',
        () => (roomMode.textContent = getRoomModeByHash()));

    const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
    }).catch(console.error);

    // Render local stream
    localVideo.muted = true;
    localVideo.srcObject = localStream;
    localVideo.playsInline = true;
    await localVideo.play().catch(console.error);

    const APIKEY = '4be4f85a-ab18-4427-9069-b6fd6dab3fd7';

    // eslint-disable-next-line require-atomic-updates
    const peer = new Peer({
        key: APIKEY,
        debug: 3,
    });

    // Register join handler
    joinTrigger.addEventListener('click', () => {
        // Note that you need to ensure the peer has connected to signaling server
        // before using methods of peer instance.
        if (!peer.open) {
            return;
        }

        const userRoom = peer.joinRoom(roomId.value + "user", {
            mode: getRoomModeByHash(),
            stream: localStream,
        });

        userRoom.once('open', () => {
            const msg = '[userRoom open] You joined the userRoom';
            messages.textContent += (msg + "\n");
            console.log(msg);
        });

        userRoom.on('peerJoin', peerId => {
            const msg = `[userRoom peerJoin] peerId: ${peerId}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
        });

        // Render remote stream for new peer join in the room
        userRoom.on('stream', async stream => {
            const msg = `[userRoom stream] stream.peerId: ${stream.peerId}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
            const newVideo = document.createElement('video');
            newVideo.srcObject = stream;
            newVideo.playsInline = true;
            // mark peerId to find it later at peerLeave event
            newVideo.setAttribute('data-peer-id', stream.peerId);
            remoteVideos.append(newVideo);
            await newVideo.play().catch(console.error);
        });

        userRoom.on('data', ({
                data,
                src
            }) => {
            // Show a message sent to the room and who sent
            const msg = `[userRoom data] ${src}: ${data}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
        });

        // for closing room members
        userRoom.on('peerLeave', peerId => {
            const remoteVideo = remoteVideos.querySelector(`[data-peer-id=${peerId}]`);
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
            remoteVideo.srcObject = null;
            remoteVideo.remove();

            const msg = `[userRoom peerLeave] peerId: ${peerId}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
        });

        // for closing myself
        userRoom.once('close', () => {
            sendTrigger.removeEventListener('click', onClickSend);
            const msg = '[userRoom close]';
            messages.textContent += (msg + "\n");
            console.log(msg);
            Array.from(remoteVideos.children).forEach(remoteVideo => {
                remoteVideo.srcObject.getTracks().forEach(track => track.stop());
                remoteVideo.srcObject = null;
                remoteVideo.remove();
            });
        });

        sendTrigger.addEventListener('click', onClickSend);
        leaveTrigger.addEventListener('click', () => userRoom.close(), {
            once: true
        });

        function onClickSend() {
            // Send message to all of the peers in the room via websocket
            userRoom.send(localText.value);
            const msg = `[sendTrigger click] ${peer.id}: ${localText.value}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
            localText.value = '';
        }

        /*** displayRoom ***/

        const dummy = document.createElement('canvas');
        let dummyStream = null;

        if ((dummyStream == null) || (!dummyStream.active)) {
            dummyStream = dummy.captureStream(10);
        }

        let displayRoom = peer.joinRoom(roomId.value + "display", {
            mode: getRoomModeByHash(),
            stream: dummyStream,
        });

        sharescreenTrigger.addEventListener('click', async() => {
			displayRoom.close();
			
            const sharescreenStream = await navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: true,
            }).catch(console.error);

            sharescreenVideo.muted = true;
            sharescreenVideo.srcObject = sharescreenStream;
            sharescreenVideo.playsInline = true;
            await sharescreenVideo.play().catch(console.error);

            // displayRoom.replaceStream(sharescreenStream);

            displayRoom = peer.joinRoom(roomId.value + "display", {
                mode: getRoomModeByHash(),
                stream: sharescreenStream,
            });

            const msg = `[sharescreenTrigger click] sharescreenStream.peerId: ${sharescreenStream.peerId}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
        });

        displayRoom.on('open', () => {
            const msg = '[displayRoom open] You joined the displayRoom';
            messages.textContent += (msg + "\n");
            console.log(msg);
        });

        displayRoom.on('peerJoin', peerId => {
            const msg = `[displayRoom peerJoin] peerId: ${peerId}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
        });

        // Render remote stream for new peer join in the room
        displayRoom.on('stream', async stream => {
            const msg = `[displayRoom stream] stream.peerId: ${stream.peerId}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
            if (sharescreenVideo.srcObject != null) {
                sharescreenVideo.srcObject.getTracks().forEach(track => track.stop());
                sharescreenVideo.srcObject = null;
            }

            sharescreenVideo.muted = true;
            sharescreenVideo.srcObject = stream;
            sharescreenVideo.playsInline = true;
            sharescreenVideo.setAttribute('data-peer-id', stream.peerId);
            await sharescreenVideo.play().catch(console.error);
        });

        // for closing room members
        displayRoom.on('peerLeave', peerId => {
            const msg = `[displayRoom peerLeave]: peerId = ${peerId}`;
            messages.textContent += (msg + "\n");
            console.log(msg);
            if (sharescreenVideo.getAttribute('data-peer-id') == peerId) {
                sharescreenVideo.srcObject.getTracks().forEach(track => track.stop());
                sharescreenVideo.srcObject = null;
            }
        });

        // for closing myself
        displayRoom.on('close', () => {
            const msg = '[displayRoom close]';
            messages.textContent += (msg + "\n");
            console.log(msg);

            sharescreenVideo.srcObject.getTracks().forEach(track => track.stop());
            sharescreenVideo.srcObject = null;
        });

    });

    peer.on('error', console.error);
})();
