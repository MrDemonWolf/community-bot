"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function UserAvatar({ userName, size = 34 }: { userName: string; size?: number }) {
  const profile = useQuery(trpc.profile.get.queryOptions());
  return profile.data?.url
    ? <img className="profile-avatar" src={profile.data.url} width={size} height={size} alt="" />
    : <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">{userName.slice(0, 1).toUpperCase() || "?"}</span>;
}
