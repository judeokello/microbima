"use client"

import * as React from "react"
import { Check, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tag } from "@/lib/api"

export interface TagOption {
  id?: number
  name: string
}

interface TagSelectorProps {
  selectedTags: TagOption[]
  onTagsChange: (tags: TagOption[]) => void
  availableTags?: Tag[]
  onSearchTags?: (search: string) => Promise<Tag[]>
  onCreateTag?: (name: string) => Promise<Tag>
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function TagSelector({
  selectedTags,
  onTagsChange,
  availableTags = [],
  onSearchTags,
  onCreateTag,
  placeholder = "Select tags...",
  disabled = false,
  className,
}: TagSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<Tag[]>([])
  const [isSearching, setIsSearching] = React.useState(false)

  // Debounced search
  React.useEffect(() => {
    if (!onSearchTags || searchQuery.length < 3) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await onSearchTags(searchQuery)
        setSearchResults(results)
      } catch (error) {
        console.error("Error searching tags:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, onSearchTags])

  const handleSelectTag = (tag: Tag | TagOption) => {
    const newTag: TagOption = {
      id: tag.id,
      name: tag.name,
    }

    // Check if tag is already selected
    const isSelected = selectedTags.some(
      (t) => t.id === tag.id || t.name.toLowerCase() === tag.name.toLowerCase()
    )

    if (isSelected) {
      return
    }

    onTagsChange([...selectedTags, newTag])
    setSearchQuery("")
    setSearchResults([])
  }

  const handleRemoveTag = (tagToRemove: TagOption) => {
    onTagsChange(selectedTags.filter((t) => t.id !== tagToRemove.id && t.name !== tagToRemove.name))
  }

  const handleCreateTag = async () => {
    if (!onCreateTag || searchQuery.trim().length === 0) {
      return
    }

    const trimmedQuery = searchQuery.trim()

    // Check if tag already exists in search results
    const existingTag = searchResults.find(
      (t) => t.name.toLowerCase() === trimmedQuery.toLowerCase()
    )

    if (existingTag) {
      handleSelectTag(existingTag)
      return
    }

    // Check if tag is already selected
    const isSelected = selectedTags.some(
      (t) => t.name.toLowerCase() === trimmedQuery.toLowerCase()
    )

    if (isSelected) {
      setSearchQuery("")
      return
    }

    try {
      const newTag = await onCreateTag(trimmedQuery)
      handleSelectTag(newTag)
      setSearchQuery("")
    } catch (error) {
      console.error("Error creating tag:", error)
    }
  }

  const displayTags = React.useMemo(() => {
    // Combine available tags and search results, removing duplicates
    const allTags = [...availableTags, ...searchResults]
    const uniqueTags = Array.from(
      new Map(allTags.map((tag) => [tag.id ?? tag.name, tag])).values()
    )

    // Filter out already selected tags
    return uniqueTags.filter(
      (tag) =>
        !selectedTags.some(
          (selected) =>
            selected.id === tag.id ||
            selected.name.toLowerCase() === tag.name.toLowerCase()
        )
    )
  }, [availableTags, searchResults, selectedTags])

  const canCreateTag =
    onCreateTag &&
    searchQuery.trim().length >= 1 &&
    !displayTags.some(
      (t) => t.name.toLowerCase() === searchQuery.trim().toLowerCase()
    ) &&
    !selectedTags.some(
      (t) => t.name.toLowerCase() === searchQuery.trim().toLowerCase()
    )

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {placeholder}
            <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search tags (min 3 chars)..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {searchQuery.length < 3 && searchQuery.length > 0
                  ? "Type at least 3 characters to search"
                  : isSearching
                    ? "Searching..."
                    : canCreateTag
                      ? "Press Enter or click to create tag"
                      : "No tags found"}
              </CommandEmpty>
              {canCreateTag && (
                <CommandGroup heading="Create new tag">
                  <CommandItem
                    onSelect={() => handleCreateTag()}
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create "{searchQuery.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}
              {displayTags.length > 0 && (
                <CommandGroup heading="Available tags">
                  {displayTags.map((tag) => (
                    <CommandItem
                      key={tag.id ?? tag.name}
                      onSelect={() => handleSelectTag(tag)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedTags.some(
                            (t) =>
                              t.id === tag.id ||
                              t.name.toLowerCase() === tag.name.toLowerCase()
                          )
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id ?? tag.name}
              variant="secondary"
              className="cursor-pointer"
            >
              {tag.name}
              <button
                type="button"
                className="ml-1 rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRemoveTag(tag)
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={() => handleRemoveTag(tag)}
                disabled={disabled}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

