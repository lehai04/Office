import type { RoomMember } from '../types/office';

/** Static rooms reserve one nickname per room. Keep the active session visible
 * while older peer snapshots still contain a second ID for that name. */
export function uniqueStaticRoomMembers(members: RoomMember[], currentUserId: string): RoomMember[] {
  const byNickname = new Map<string, RoomMember>();
  const rank = (member: RoomMember) => member.userId === currentUserId ? 2 : member.isManager ? 1 : 0;
  for (const member of members) {
    const nickname = member.nickname.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
    const key = JSON.stringify([member.roomId, nickname || member.userId]);
    const previous = byNickname.get(key);
    if (!previous || rank(member) > rank(previous) || (
      rank(member) === rank(previous) && (
        member.joinedAt < previous.joinedAt ||
        (member.joinedAt === previous.joinedAt && member.userId < previous.userId)
      )
    )) {
      byNickname.set(key, member);
    }
  }
  return [...byNickname.values()];
}
