import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}

const NoDataDialog = ({ open, onOpenChange, date }: Props) => {
  const formattedDate = new Date(date).toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="text-6xl mb-3">📭</div>
          <DialogTitle className="text-xl font-black text-foreground">কোনো তথ্য নেই</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-semibold leading-relaxed mt-2">
            দুঃখিত! <span className="text-primary font-bold">{formattedDate}</span> তারিখের কোনো তথ্য সংরক্ষিত নেই। আজকের তারিখে ফিরে গিয়ে আপনার কার্যক্রম রেকর্ড করুন।
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default NoDataDialog;
