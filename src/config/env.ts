// src/config/env.ts

// Toggle this when you want to test locally
const DEV = false;

/*
 DEV mode examples:
 Android emulator → http://10.0.2.2:4001
 Real device → http://YOUR_LOCAL_IP:4001
*/
// const DEV_SOCKET_URL = "http://10.0.2.2:4001";

// Production tunnel (what you just finished)
const PROD_SOCKET_URL = "https://socket.celeonetv.com";

export const SOCKET_URL =  PROD_SOCKET_URL;

export const ENV = {
  dev: DEV,
  socketUrl: SOCKET_URL,
};
