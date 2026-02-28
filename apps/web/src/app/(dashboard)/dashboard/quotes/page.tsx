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
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";

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

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Quotes</h1>
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
        <h1 className="mb-6 text-2xl font-bold text-foreground">Quotes</h1>
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
      <h1 className="mb-6 text-2xl font-bold text-foreground">Quotes</h1>

      <div className="space-y-4">
        {/* Add + Search bar */}
        <div className="flex flex-wrap items-end gap-3">
          {canManage && (
            <div className="flex flex-1 items-center gap-2">
              <Input
                placeholder="Add a new quote..."
                value={newQuoteText}
                onChange={(e) => setNewQuoteText(e.target.value)}
                className="min-w-[200px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newQuoteText.trim()) {
                    addMutation.mutate({ text: newQuoteText.trim() });
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (newQuoteText.trim()) {
                    addMutation.mutate({ text: newQuoteText.trim() });
                  }
                }}
                disabled={!newQuoteText.trim() || addMutation.isPending}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-8"
            />
          </div>
        </div>

        {/* Quotes Table */}
        {(filteredQuotes?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
            <QuoteIcon className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No quotes match your search." : "No quotes yet. Add one above!"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
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
                  {canManage && (
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredQuotes?.map((q) => (
                  <tr
                    key={q.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                      {q.quoteNumber}
                    </td>
                    <td className="max-w-md px-4 py-3 text-sm text-foreground">
                      <span className="line-clamp-2">&ldquo;{q.text}&rdquo;</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {q.game || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {q.addedBy}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {deleteConfirmId === q.id ? (
                          <div className="flex items-center justify-end gap-1">
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
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {quotes?.length ?? 0} quote{(quotes?.length ?? 0) !== 1 ? "s" : ""} total
        </p>
      </div>
    </div>
  );
}
