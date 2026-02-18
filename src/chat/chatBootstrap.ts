// src/chat/chatBootstrap.ts
import { auth } from "../../app/source/modules/auth/firebaseConfig";
import { initChatDb } from "./localDb";
import {
  initSocketAuth,
  connectSocketOnce,
  attachGlobalChatListeners,
  getSocketOrNull,
} from "./socket";

let bootstrapped = false;

type BootOpts = {
  socketUrl: string;
  getToken?: () => Promise<string>;
  getUid?: () => string | null;
};

export async function bootstrapChat(socketUrl: string): Promise<void>;
export async function bootstrapChat(opts: BootOpts): Promise<void>;

export async function bootstrapChat(arg: string | BootOpts): Promise<void> {
  if (bootstrapped) return;

  const socketUrl = typeof arg === "string" ? arg : arg.socketUrl;
  console.log("[chat] bootstrap start:", socketUrl);

  // 1) Setup auth providers FIRST (only once)
  const getUid =
    typeof arg !== "string" && arg.getUid
      ? arg.getUid
      : () => auth.currentUser?.uid ?? null;

  const getToken =
    typeof arg !== "string" && arg.getToken
      ? arg.getToken
      : async () => {
          const user = auth.currentUser;
          if (!user) throw new Error("NO_USER");
          const t = await user.getIdToken(true);
          console.log("[chat] token length:", t?.length);
          return t;
        };

  initSocketAuth({ getUid, getToken });

  // 2) Init local DB (doesn't need network)
  await initChatDb();
  console.log("[chat] sqlite ready");

  // 3) Connect ONCE (after token provider is ready)
  const s = await connectSocketOnce(socketUrl);
  console.log("[chat] socket created");

  attachGlobalChatListeners();

  s.on("connect", () => console.log("[chat] connected:", s.id));
  s.on("disconnect", (r) => console.log("[chat] disconnected:", r));
  s.on("connect_error", (e) => console.log("[chat] connect_error:", e?.message || e));

  if (!getSocketOrNull()) {
    console.log("[chat] WARNING: socket still null after connect");
  }

  bootstrapped = true;
}
