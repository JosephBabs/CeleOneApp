import React from "react";
import Video from "react-native-video";

const LiveHlsPlayer = React.memo(({ uri, paused }) => {
    return (
      <Video
        source={{ uri, type: 'm3u8' }}
        style={styles.tvImage}
        resizeMode="contain"
        paused={paused}
        controls={false}
        bufferConfig={{
          minBufferMs: 2000,
          maxBufferMs: 8000,
          bufferForPlaybackMs: 1000,
          bufferForPlaybackAfterRebufferMs: 2000,
        }}
        automaticallyWaitsToMinimizeStalling={false}
        ignoreSilentSwitch="ignore"
      />
    );
  });
