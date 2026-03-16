"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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

  const [newQuoteText, setNewQuoteText] = useState("");
  const [newQuoteGame, setNewQuoteGame] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const addMutation = useMutation(
    trpc.quote.add.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Quote #${data.quoteNumber} added.`);
        setNewQuoteText("");
        setNewQuoteGame("");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeMutation = useMutation(
    trpc.quote.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Quote removed.");
        setDeleteConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
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

  return (
    <div>
      <PageHeader title="Quotes" platforms={["twitch", "discord"]} />

      <div className="space-y-4">
        {/* Add Quote */}
        {canManage && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Quote text..."
              value={newQuoteText}
              onChange={(e) => setNewQuoteText(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newQuoteText.trim()) {
                  addMutation.mutate({ text: newQuoteText.trim(), game: newQuoteGame.trim() || null });
                }
              }}
            />
            <Input
              placeholder="Game (optional)"
              value={newQuoteGame}
              onChange={(e) => setNewQuoteGame(e.target.value)}
              className="sm:w-44"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newQuoteText.trim()) {
                  addMutation.mutate({ text: newQuoteText.trim(), game: newQuoteGame.trim() || null });
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (newQuoteText.trim()) {
                  addMutation.mutate({ text: newQuoteText.trim(), game: newQuoteGame.trim() || null });
                }
              }}
              disabled={!newQuoteText.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add
            </Button>
          </div>
        )}

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

        {/* Quotes Table */}
        {(filteredQuotes?.length ?? 0) === 0 ? (
          <EmptyState
            icon={QuoteIcon}
            title={searchQuery ? "No quotes match your search." : "No quotes yet."}
            description={
              !searchQuery
                ? "Add memorable moments from your stream to look back on later."
                : undefined
            }
          />
        ) : (
          <div className="glass overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Quote
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Game
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Added By
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredQuotes?.map((q) => (
                  <tr
                    key={q.id}
                    className="transition-colors hover:bg-surface-raised"
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
                    <td className="px-4 py-3 text-sm text-muted-foreground">
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
        )}

        <p className="text-xs text-muted-foreground">
          {quotes?.length ?? 0} quote{(quotes?.length ?? 0) !== 1 ? "s" : ""}{" "}
          total
        </p>
      </div>
    </div>
  );
}
