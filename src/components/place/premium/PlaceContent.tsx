"use client";

import { motion } from "framer-motion";
import { BookOpen, Check, GraduationCap, Palette, Users } from "lucide-react";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";

interface PlaceContentProps {
  description: string;
  features?: string[];
  amenities?: string[];
}

export function PlaceContent({ description, features, amenities }: PlaceContentProps) {
  const featureItems = buildFeatures(features, amenities);

  return (
    <div className="space-y-16">
      <section id="about" className="scroll-mt-32">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-7"
        >
          <h2 className="max-w-4xl text-3xl font-black leading-[1.02] tracking-[-0.02em] text-[#0D1025]">
            Курсы, занятия и события, которые хочется прожить, а не просто посетить
          </h2>
          <RichContentRenderer
            html={description}
            className="max-w-[70ch] text-lg leading-relaxed text-[#555A70] prose-headings:text-[#0D1025] prose-h2:mt-0 prose-h3:mt-0 prose-p:text-lg prose-p:leading-9 prose-p:text-[#555A70] prose-p:my-0 prose-strong:text-[#0D1025] prose-li:text-lg prose-li:leading-[1.75] [&>*+*]:mt-11"
          />
        </motion.div>
      </section>

      <section id="benefits" className="scroll-mt-32">
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-120px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {featureItems.map((item) => (
            <motion.div
              key={item.title}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5 }}
              className={`rounded-[32px] border border-white/70 bg-gradient-to-br ${item.gradient} p-6 shadow-[0_24px_80px_rgba(17,19,34,0.08)] backdrop-blur-xl`}
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/75 text-[#EF8759] shadow-[0_14px_36px_rgba(17,19,34,0.08)]">
                {item.icon}
              </div>
              <h3 className="text-xl font-black text-[#111322]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#606579]">{item.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {amenities && amenities.length > 0 && (
        <section className="rounded-[32px] border border-white/70 bg-white/55 p-6 backdrop-blur-xl">
          <div className="mb-5 text-sm font-black uppercase tracking-[0.2em] text-[#8D92A8]">
            Детали
          </div>
          <div className="flex flex-wrap gap-3">
            {amenities.slice(0, 12).map((amenity) => (
              <span
                key={amenity}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-[#303345]"
              >
                <Check className="h-4 w-4 text-[#EF8759]" />
                {amenity}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function buildFeatures(features?: string[], amenities?: string[]) {
  const fallback = [
    "Опытные преподаватели",
    "Индивидуальный подход",
    "Творческая атмосфера",
    "Программы 1-11 классов",
  ];
  const source = [...(features || []), ...(amenities || [])].filter(Boolean);
  const labels = (source.length ? source : fallback).slice(0, 4);
  const icons = [
    <GraduationCap className="h-7 w-7" key="graduation" />,
    <Users className="h-7 w-7" key="users" />,
    <Palette className="h-7 w-7" key="palette" />,
    <BookOpen className="h-7 w-7" key="book" />,
  ];
  const gradients = [
    "from-white/86 to-[#FFF0EA]/82",
    "from-white/86 to-[#F0EFFF]/82",
    "from-white/86 to-[#EEF7FF]/82",
    "from-white/86 to-[#F8F2FF]/82",
  ];

  return labels.map((label, index) => ({
    title: label,
    text:
      index === 0
        ? "Команда выстраивает занятие вокруг ребенка, темпа группы и понятного результата."
        : index === 1
          ? "Мягкая коммуникация, внимательное сопровождение и пространство для уверенности."
          : index === 2
            ? "Живые форматы, игровые сценарии и ощущение, что обучение может быть красивым."
            : "Структура программ помогает двигаться спокойно: от первых шагов до сильной базы.",
    icon: icons[index],
    gradient: gradients[index],
  }));
}
