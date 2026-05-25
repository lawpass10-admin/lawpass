import { HeaderStrip } from "@/app/(app)/dashboard/_components/header-strip";
import {
  getMasteryByChapter,
  getStatusContext,
} from "@/app/(app)/dashboard/_lib/queries";

type Props = {
  userId: string;
  fullName: string;
  examDate: Date | null;
  daysToExam: number | null;
};

export async function HeaderStripAsync({
  userId,
  fullName,
  examDate,
  daysToExam,
}: Props) {
  const mastery = await getMasteryByChapter(userId);
  const status = await getStatusContext(userId, mastery);
  return (
    <HeaderStrip
      fullName={fullName}
      examDate={examDate}
      daysToExam={daysToExam}
      status={status}
    />
  );
}
