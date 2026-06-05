"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Surface } from "@/components/ui/surface";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { H1, H2, H3, Body, BodyMuted } from "@/components/ui/typography";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WhenSelect } from "@/components/ui/when-select";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { Chip } from "@/components/ui/Chip";
import { ChipsRow } from "@/components/ui/chips-row";
import { MediaCover } from "@/components/ui/media-cover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { formatPriceFrom } from "@/lib/formatters/format-price";

function ChipsRowLabDemo() {
  const [masonrySelected, setMasonrySelected] = React.useState<string[]>([]);
  const masonryAgeItems = AGE_GROUPS.map((g) => ({
    id: g.value,
    label: g.label,
    active: masonrySelected.includes(g.value),
    onClick: () =>
      setMasonrySelected((prev) =>
        prev.includes(g.value) ? prev.filter((x) => x !== g.value) : [...prev, g.value],
      ),
  }));

  return (
    <Tabs defaultValue="masonry" className="w-full max-w-md">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="scroll">Scroll</TabsTrigger>
        <TabsTrigger value="wrap">Wrap</TabsTrigger>
        <TabsTrigger value="masonry">Masonry</TabsTrigger>
      </TabsList>
      <TabsContent value="scroll" className="mt-3">
        <ChipsRow
          aria-label="Пример scroll"
          items={[
            { id: "a", label: "0–1 год" },
            { id: "b", label: "1–3 года", active: true },
            { id: "c", label: "3–5 лет" },
          ]}
        />
      </TabsContent>
      <TabsContent value="wrap" className="mt-3">
        <ChipsRow
          layout="wrap"
          aria-label="Пример wrap"
          items={[
            { id: "a", label: "0–1 год" },
            { id: "b", label: "1–3 года", active: true },
            { id: "c", label: "3–5 лет" },
            { id: "d", label: "5–7 лет" },
          ]}
        />
      </TabsContent>
      <TabsContent value="masonry" className="mt-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="p-[15px]">
            <ChipsRow
              layout="masonry"
              aria-label="Возраст детей"
              items={masonryAgeItems}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function UiPrimitivesSection() {
  return (
    <DemoSection
      id="ui-primitives"
      title="UI Primitives"
      description="Core building blocks from src/components/ui"
    >
      <InventoryGrid>
        <RenderSafe title="Button" file="src/components/ui/button.tsx">
          <div className="flex gap-2 flex-wrap">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </RenderSafe>

        <RenderSafe title="PrimaryButton" file="src/components/ui/PrimaryButton.tsx">
          <PrimaryButton>Primary Action</PrimaryButton>
        </RenderSafe>

        <RenderSafe title="Badge" file="src/components/ui/badge.tsx">
          <div className="flex gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </RenderSafe>

        <RenderSafe title="Input" file="src/components/ui/input.tsx">
          <Input placeholder="Type something..." />
        </RenderSafe>

        <RenderSafe title="Checkbox" file="src/components/ui/checkbox.tsx">
          <div className="flex items-center space-x-2">
            <Checkbox id="terms" />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Accept terms
            </label>
          </div>
        </RenderSafe>

        <RenderSafe title="Separator" file="src/components/ui/separator.tsx">
          <div className="space-y-1">
            <div className="text-sm">Above</div>
            <Separator />
            <div className="text-sm">Below</div>
          </div>
        </RenderSafe>

        <RenderSafe title="Typography" file="src/components/ui/typography.tsx">
          <div className="space-y-2">
            <H1>Heading 1</H1>
            <H2>Heading 2</H2>
            <H3>Heading 3</H3>
            <Body>Body text</Body>
            <BodyMuted>Muted body text</BodyMuted>
          </div>
        </RenderSafe>

        <RenderSafe title="Card" file="src/components/ui/card.tsx">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Card Content</p>
            </CardContent>
          </Card>
        </RenderSafe>

        <RenderSafe title="Surface" file="src/components/ui/surface.tsx">
          <Surface className="p-4">Surface Content</Surface>
        </RenderSafe>

        <RenderSafe title="Container" file="src/components/ui/Container.tsx">
          <div className="border border-dashed p-2">
            <Container>Container Content</Container>
          </div>
        </RenderSafe>

        <RenderSafe title="Section" file="src/components/ui/Section.tsx">
          <Section title="Section Title" action={<Button size="sm">Action</Button>}>
            Section Content
          </Section>
        </RenderSafe>

        <RenderSafe title="ScrollArea" file="src/components/ui/scroll-area.tsx">
          <ScrollArea className="h-[100px] w-full rounded-md border p-4">
            Scrollable Content...
          </ScrollArea>
        </RenderSafe>

        <RenderSafe title="WhenSelect (Desktop) — States" file="src/components/ui/when-select.tsx">
          <div className="grid gap-4 sm:grid-cols-2">
            <WhenSelect uiMode="desktop" />
            <WhenSelect uiMode="desktop" value="today" />
            <WhenSelect uiMode="desktop" disabled />
            <WhenSelect uiMode="desktop" loading />
            <WhenSelect uiMode="desktop" errorText="Ошибка загрузки дат" />
          </div>
        </RenderSafe>
        <RenderSafe title="WhenSelect (Mobile) — States" file="src/components/ui/when-select.tsx">
          <div className="grid gap-4 max-w-sm">
            <WhenSelect uiMode="mobile" />
            <WhenSelect uiMode="mobile" value="tomorrow" />
            <WhenSelect uiMode="mobile" disabled />
            <WhenSelect uiMode="mobile" loading />
            <WhenSelect uiMode="mobile" errorText="Ошибка загрузки дат" />
          </div>
        </RenderSafe>

        <RenderSafe title="CardSelect" file="src/components/ui/card-select.tsx">
          <CardSelect 
            label="Demo Select" 
            options={[{value: '1', label: 'Option 1'}, {value: '2', label: 'Option 2'}]}
            value={null}
            onChange={() => {}}
            uiMode="desktop"
          />
        </RenderSafe>

        <RenderSafe title="CardMultiSelect" file="src/components/ui/card-multiselect.tsx">
          <CardMultiSelect 
            label="Demo Multi" 
            options={[{value: '1', label: 'Option 1'}, {value: '2', label: 'Option 2'}]}
            values={[]}
            onChange={() => {}}
            uiMode="desktop"
          />
        </RenderSafe>

        <RenderSafe title="FavoriteButton" file="src/components/ui/FavoriteButton.tsx">
           <div className="flex gap-4">
             <FavoriteButton initialLiked={false} />
             <FavoriteButton initialLiked={true} />
           </div>
        </RenderSafe>

        <RenderSafe title="Chip" file="src/components/ui/Chip.tsx">
          <div className="flex gap-2">
            <Chip>Default</Chip>
            <Chip active>Active</Chip>
          </div>
        </RenderSafe>

        <RenderSafe title="ChipsRow" file="src/components/ui/chips-row.tsx">
          <ChipsRowLabDemo />
        </RenderSafe>

        <RenderSafe title="MediaCover" file="src/components/ui/media-cover.tsx">
           <div className="h-32 w-24 relative">
             <MediaCover imageUrl="https://picsum.photos/seed/ui-lab/200/300" />
           </div>
        </RenderSafe>

        <RenderSafe title="ActivityCard (Portrait)" file="src/components/activity/ActivityCard.tsx">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <ActivityCard 
              id="demo-place"
              title="Семейное кафе «Андерсон»"
              image="https://picsum.photos/seed/place/400/500"
              badge="Популярное"
              age="0+"
              dateLabel="10:00–22:00"
              priceLabel={formatPriceFrom(30)}
              rating={4.8}
            />
            <ActivityCard 
              id="demo-event"
              title="Жаночы дзень"
              image="https://picsum.photos/seed/event/400/500"
              age="0+"
              dateLabel="8 марта"
              priceLabel="Минск • Дукорский маёнтак"
            />
          </div>
        </RenderSafe>

        {/* Listed only due to prop complexity or context needs */}
        <RenderSafe title="IconButton" file="src/components/ui/IconButton.tsx" listedOnly />
        <RenderSafe title="MultiSelectTab" file="src/components/ui/multiselect-tab.tsx" listedOnly />
        <RenderSafe title="PillPopoverSelect" file="src/components/ui/pill-popover-select.tsx" listedOnly />
        <RenderSafe title="Popover" file="src/components/ui/popover.tsx" listedOnly />
        <RenderSafe title="Sheet" file="src/components/ui/sheet.tsx" listedOnly />
        <RenderSafe title="Dialog" file="src/components/ui/dialog.tsx" listedOnly />
        <RenderSafe title="Command" file="src/components/ui/command.tsx" listedOnly />
        <RenderSafe title="Sonner" file="src/components/ui/sonner.tsx" listedOnly />
        <RenderSafe title="Select" file="src/components/ui/select.tsx" listedOnly />
        <RenderSafe title="Icons" file="src/components/ui/icons.tsx" listedOnly />

      </InventoryGrid>
    </DemoSection>
  );
}
