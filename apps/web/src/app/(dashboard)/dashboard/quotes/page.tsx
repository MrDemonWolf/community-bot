"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { withToast } from "@/hooks/use-toast-mutation";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Search,
  Quote as QuoteIcon,
  Copy,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function QuotesPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.quote.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: quotes, isLoading } = useQuery(
    trpc.quote.list.queryOptions()
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState("");
  const [newQuoteGame, setNewQuoteGame] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const addMutation = useMutation(
    withToast(trpc.quote.add.mutationOptions({
      onSuccess: () => {
        setNewQuoteText("");
        setNewQuoteGame("");
        setDialogOpen(false);
        invalidateAll();
      },
    }), "Quote added.")
  );

  const removeMutation = useMutation(
    withToast(trpc.quote.remove.mutationOptions({
      onSuccess: () => {
        setDeleteConfirmId(null);
        invalidateAll();
      },
    }), "Quote removed.")
  );

  function copyQuote(text: string, quoteNumber: number) {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success(`Quote #${quoteNumber} copied to clipboard.`);
      },
      () => {
        toast.error("Failed to copy to clipboard.");
      }
    );
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Quotes" platforms={["twitch", "discord"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage quotes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Quotes" platforms={["twitch", "discord"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const filteredQuotes = searchQuery
    ? quotes?.filter((q) =>
        q.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : quotes;

  const totalCount = quotes?.length ?? 0;

  return (
    <div>
      <PageHeader title="Quotes" platforms={["twitch", "discord"]}>
        <span className="inline-flex items-center rounded-full bg-brand-main/10 px-2.5 py-0.5 text-xs font-medium text-brand-main">
          {totalCount}
        </span>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-brand-main text-white hover:bg-brand-main/80"
          >
            <Plus className="size-3.5" />
            Add Quote
          </Button>
        )}
      </PageHeader>

      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Quotes List */}
        {(filteredQuotes?.length ?? 0) === 0 ? (
          <EmptyState
            icon={QuoteIcon}
            title={searchQuery ? "No quotes match your search." : "No quotes yet."}
            description={
              !searchQuery
                ? "Add memorable moments from your stream to look back on later."
                : undefined
            }
          >
            {!searchQuery && canManage && (
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="size-3.5" />
                Add your first quote
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Quote
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Game
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Added By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredQuotes?.map((q) => (
                        <tr
                          key={q.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-brand-main">
                              {q.quoteNumber}
                            </span>
                          </td>
                          <td className="max-w-md px-4 py-3 text-sm text-foreground">
                            <span className="line-clamp-2 break-words">
                              &ldquo;{q.text}&rdquo;
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm italic text-muted-foreground">
                            {q.game || "--"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {q.addedBy}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                            {new Date(q.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => copyQuote(q.text, q.quoteNumber)}
                                aria-label={`Copy quote #${q.quoteNumber}`}
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                              </Button>
                              {canManage && (
                                <>
                                  {deleteConfirmId === q.id ? (
                                    <>
                                      <Button
                                        variant="destructive"
                                        size="xs"
                                        onClick={() =>
                                          removeMutation.mutate({ id: q.id })
                                        }
                                        disabled={removeMutation.isPending}
                                      >
                                        {removeMutation.isPending ? "..." : "Confirm"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setDeleteConfirmId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => setDeleteConfirmId(q.id)}
                                      aria-label={`Remove quote #${q.quoteNumber}`}
                                    >
                                      <Trash2 className="size-3.5 text-red-400" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="grid gap-3 md:hidden">
              {filteredQuotes?.map((q) => (
                <Card key={q.id} className="transition-colors hover:bg-muted/30">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="shrink-0 rounded-full bg-brand-main/10 px-2 py-0.5 text-xs font-bold text-brand-main">
                        #{q.quoteNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => copyQuote(q.text, q.quoteNumber)}
                          aria-label={`Copy quote #${q.quoteNumber}`}
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                        </Button>
                        {canManage && (
                          <>
                            {deleteConfirmId === q.id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="destructive"
                                  size="xs"
                                  onClick={() =>
                                    removeMutation.mutate({ id: q.id })
                                  }
                                  disabled={removeMutation.isPending}
                                >
                                  {removeMutation.isPending ? "..." : "Confirm"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeleteConfirmId(q.id)}
                                aria-label={`Remove quote #${q.quoteNumber}`}
                              >
                                <Trash2 className="size-3.5 text-red-400" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground">
                      &ldquo;{q.text}&rdquo;
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {q.game && (
                        <span className="italic">{q.game}</span>
                      )}
                      <span>by {q.addedBy}</span>
                      <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          {totalCount} quote{totalCount !== 1 ? "s" : ""} total
          {searchQuery && filteredQuotes
            ? ` (${filteredQuotes.length} matching)`
            : ""}
        </p>
      </div>

      {/* Add Quote Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup>
          <DialogCloseButton />
          <DialogTitle>Add Quote</DialogTitle>
          <DialogDescription>
            Save a memorable moment from your stream.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newQuoteText.trim()) {
                addMutation.mutate({
                  text: newQuoteText.trim(),
                  game: newQuoteGame.trim() || null,
                });
              }
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Quote Text
              </label>
              <Input
                value={newQuoteText}
                onChange={(e) => setNewQuoteText(e.target.value)}
                placeholder="Enter the quote..."
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Game{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={newQuoteGame}
                onChange={(e) => setNewQuoteGame(e.target.value)}
                placeholder="e.g. Minecraft"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setNewQuoteText("");
                  setNewQuoteGame("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newQuoteText.trim() || addMutation.isPending}
                className="bg-brand-main text-white hover:bg-brand-main/80"
              >
                {addMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add Quote
              </Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
