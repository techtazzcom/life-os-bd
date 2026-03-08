import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

const DeleteConfirmDialog = ({ open, onOpenChange, onConfirm, title = "ডিলেট করতে চান?", description = "এটি মুছে ফেলা হবে এবং পুনরুদ্ধার করা যাবে না।" }: Props) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-black text-foreground flex items-center gap-2">⚠️ {title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground font-semibold">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl font-bold">না, রাখুন</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">হ্যাঁ, ডিলেট করুন</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteConfirmDialog;
