import { HeaderStrip } from "@/app/(app)/dashboard/_components/header-strip";
import { getStatusContext } from "@/app/(app)/dashboard/_lib/queries";

type Props = {
  fullName: string;
  examDate: Date | null;
  daysToExam: number | null;
};

export async function HeaderStripAsync({
  fullName,
  examDate,
  daysToExam,
}: Props) {
  // The mastery read that used to sit here is gone: it existed only to be
  // passed into getStatusContext, and /api/dashboard/overview now derives
  // status from mastery server-side. See _lib/queries.
  const status = await getStatusContext();
  return (
    <HeaderStrip
      fullName={fullName}
      examDate={examDate}
      daysToExam={daysToExam}
      status={status}
    />
  );
}
