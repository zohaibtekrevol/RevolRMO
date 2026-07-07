import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, Plus, X, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { CrTag } from "@shared/schema";

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagBadge({
  tag,
  onRemove,
}: {
  tag: CrTag;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex max-w-[12rem] items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-none text-white"
      style={{ backgroundColor: tag.color }}
      data-testid={`badge-tag-${tag.id}`}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-full hover:bg-black/20"
          data-testid={`button-remove-tag-${tag.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function TagSelector({ selectedTagIds, onChange, disabled }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const { data: tags = [] } = useQuery<CrTag[]>({
    queryKey: ["/api/cr-tags"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/cr-tags", { name });
      return (await res.json()) as CrTag;
    },
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cr-tags"] });
      if (!selectedTagIds.includes(tag.id)) {
        onChange([...selectedTagIds, tag.id]);
      }
      setQuery("");
    },
    onError: () => {
      toast({ title: "Could not create tag", variant: "destructive" });
    },
  });

  const selectedTags = selectedTagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is CrTag => Boolean(t));

  const trimmed = query.trim();
  const filtered = trimmed
    ? tags.filter((t) => t.name.toLowerCase().includes(trimmed.toLowerCase()))
    : tags;
  const exactMatch = tags.some(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
  );

  const toggle = (id: string) => {
    if (selectedTagIds.includes(id)) {
      onChange(selectedTagIds.filter((t) => t !== id));
    } else {
      onChange([...selectedTagIds, id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" data-testid="container-selected-tags">
        {selectedTags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} onRemove={() => toggle(tag.id)} />
        ))}
        {selectedTags.length === 0 && (
          <span className="text-xs text-muted-foreground">No tags yet</span>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-1.5"
            data-testid="button-add-tag"
          >
            <TagIcon className="h-3.5 w-3.5" />
            Add tags
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create tag..."
              value={query}
              onValueChange={setQuery}
              data-testid="input-tag-search"
            />
            <CommandList>
              {filtered.length === 0 && !trimmed && (
                <CommandEmpty>No tags yet. Type to create one.</CommandEmpty>
              )}
              <CommandGroup>
                {filtered.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.id}
                      onSelect={() => toggle(tag.id)}
                      data-testid={`option-tag-${tag.id}`}
                    >
                      <span
                        className="mr-2 h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 truncate">{tag.name}</span>
                      {isSelected && <Check className="h-4 w-4" />}
                    </CommandItem>
                  );
                })}
                {trimmed && !exactMatch && (
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={() => createMutation.mutate(trimmed)}
                    disabled={createMutation.isPending}
                    data-testid="option-create-tag"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="truncate">Create "{trimmed}"</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
