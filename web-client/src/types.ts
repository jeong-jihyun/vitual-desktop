export interface Device {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeenAt: string | null;
  createdAt: string;
}
