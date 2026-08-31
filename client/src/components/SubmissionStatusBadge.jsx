import { FileEdit, Clock, Eye, MessageSquareWarning, CheckCircle2, XCircle, Rocket } from "lucide-react";
import { submissionStatusLabel, submissionStatusTone } from "../lib/submissions";

const ICONS = {
  draft: FileEdit,
  pending_review: Clock,
  under_review: Eye,
  changes_requested: MessageSquareWarning,
  approved: CheckCircle2,
  rejected: XCircle,
  published: Rocket,
};

export default function SubmissionStatusBadge({ status, size = 13 }) {
  const Icon = ICONS[status] || Clock;
  return (
    <span className={"submission-status-badge tone-" + submissionStatusTone(status)}>
      <Icon size={size} />
      {submissionStatusLabel(status)}
    </span>
  );
}
