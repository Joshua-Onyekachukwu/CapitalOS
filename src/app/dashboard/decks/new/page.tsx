"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableSlideItem({
  slide,
  index,
  isSelected,
  onSelect,
}: {
  slide: Slide;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `slide-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto" as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        onClick={onSelect}
        className={`w-full text-left p-[12px] rounded-[12px] transition-all ${
          isSelected
            ? "bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800"
            : "bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50"
        } ${isDragging ? "shadow-lg ring-2 ring-lime-400" : ""}`}
      >
        <div className="flex items-center gap-[10px]">
          {/* Drag handle */}
          <div
            {...listeners}
            className="w-[20px] h-[20px] rounded flex items-center justify-center flex-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
          >
            <i className="ri-draggable text-[16px]"></i>
          </div>
          <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center flex-none text-[11px] font-bold ${
            isSelected ? "bg-lime-500 text-black" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
          }`}>{index + 1}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">{slide.title}</p>
            <p className="text-[11px] text-gray-400 !mb-0">{SLIDE_TYPE_LABELS[slide.type] || slide.type}</p>
          </div>
          <i className={`${SLIDE_TYPE_ICONS[slide.type] || "ri-file-line"} text-[14px] ${
            isSelected ? "text-lime-500" : "text-gray-300"
          }`}></i>
        </div>
      </button>
    </div>
  );
}

interface Slide {
  type: string;
  title: string;
  content: string;
  bullets?: string[];
  metrics?: Array<{ label: string; value: string }>;
}

interface DesignDirection {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

const SLIDE_TYPE_ICONS: Record<string, string> = {
  cover: "ri-megaphone-line", problem: "ri-error-warning-line", solution: "ri-lightbulb-line",
  market: "ri-bar-chart-grouped-line", product: "ri-box-3-line", traction: "ri-line-chart-line",
  business_model: "ri-money-dollar-circle-line", competition: "ri-sword-line",
  team: "ri-team-line", ask: "ri-hand-coin-line", vision: "ri-eye-line",
};

const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "Cover", problem: "Problem", solution: "Solution", market: "Market",
  product: "Product", traction: "Traction", business_model: "Business Model",
  competition: "Competition", team: "Team", ask: "The Ask", vision: "Vision",
};

const DECK_STYLES = [
  { id: "investor", name: "Investor-First", desc: "Data-heavy, metrics-focused", icon: "ri-line-chart-line", color: "bg-gray-50 border-gray-300" },
  { id: "minimal", name: "Minimal", desc: "Clean lines, white space", icon: "ri-layout-line", color: "bg-white border-gray-200" },
  { id: "bold", name: "Bold", desc: "Strong colors, high contrast", icon: "ri-fire-line", color: "bg-[#B71C1C] text-white" },
  { id: "corporate", name: "Corporate", desc: "Professional, trustworthy", icon: "ri-briefcase-line", color: "bg-blue-50 border-blue-200" },
  { id: "modern", name: "Modern", desc: "Gradient accents, smooth", icon: "ri-sparkling-2-line", color: "bg-gradient-to-br from-purple-50 to-blue-50" },
];

export default function NewDeckPage() {
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [design, setDesign] = useState<DesignDirection | null>(null);
  const [pptxUrl, setPptxUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState("investor");
  const [slideCount, setSlideCount] = useState(10);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editBullets, setEditBullets] = useState("");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeIdx = parseInt(String(active.id).replace("slide-", ""));
    const overIdx = parseInt(String(over.id).replace("slide-", ""));
    if (activeIdx === overIdx) return;

    const updated = [...slides];
    const [moved] = updated.splice(activeIdx, 1);
    updated.splice(overIdx, 0, moved);
    setSlides(updated);

    // Keep selected slide in sync
    if (selectedSlide === activeIdx) {
      setSelectedSlide(overIdx);
    } else if (activeIdx < selectedSlide && overIdx >= selectedSlide) {
      setSelectedSlide((s) => s - 1);
    } else if (activeIdx > selectedSlide && overIdx <= selectedSlide) {
      setSelectedSlide((s) => s + 1);
    }
  };

  const checkProfile = useCallback(async () => {
    try {
      const { getOrCreateCompanyProfile } = await import("@/lib/actions/company");
      const profile = await getOrCreateCompanyProfile();
      if (profile && profile.onboardingCompleted) {
        setProfileReady(true);
        setCompanyName(profile.companyName || "Your Company");
      }
    } catch { /* No profile */ }
  }, []);

  useEffect(() => { checkProfile(); }, [checkProfile]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const startTime = Date.now();
    try {
      const response = await fetch("/api/deck/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: selectedStyle, slideCount }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Generation failed"); return; }

      setSlides(data.slides || []);
      setDesign(data.designDirection);
      setPptxUrl(data.pptxUrl);
      setPdfUrl(data.pdfUrl);
      setGenerationTime(Math.round((Date.now() - startTime) / 1000));
      setSelectedSlide(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setGenerating(false); }
  };

  const startEditSlide = (index: number) => {
    const slide = slides[index];
    setEditingSlide(index);
    setEditTitle(slide.title);
    setEditContent(slide.content);
    setEditBullets((slide.bullets || []).join("\n"));
  };

  const saveEditSlide = () => {
    if (editingSlide === null) return;
    const updated = [...slides];
    updated[editingSlide] = {
      ...updated[editingSlide],
      title: editTitle,
      content: editContent,
      bullets: editBullets.split("\n").filter((b) => b.trim()),
    };
    setSlides(updated);
    setEditingSlide(null);
  };

  const cancelEdit = () => { setEditingSlide(null); };

  const deleteSlide = (index: number) => {
    if (slides.length <= 3) return;
    const updated = slides.filter((_, i) => i !== index);
    setSlides(updated);
    if (selectedSlide >= updated.length) setSelectedSlide(updated.length - 1);
  };

  if (!profileReady && !generating) {
    return (
      <div>
        <PageHeader title="Generate Pitch Deck" description="Create an AI-powered investor pitch deck." />
        <Card>
          <CardBody className="text-center py-[60px]">
            <div className="w-[64px] h-[64px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px]">
              <i className="ri-file-ppt-2-line text-gray-400 text-[28px]"></i>
            </div>
            <h3 className="!text-[16px] !font-semibold !mb-[6px]">Complete onboarding first</h3>
            <p className="text-[14px] text-gray-500 !mb-[20px] max-w-[400px] mx-auto">
              We need your company information to generate a personalized pitch deck.
            </p>
            <Link href="/onboarding"><Button>Complete Onboarding</Button></Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Generate Pitch Deck${companyName ? ` — ${companyName}` : ""}`}
        description="AI generates a complete investor pitch deck from your company profile."
        actions={slides.length > 0 ? (
          <div className="flex items-center gap-[10px]">
            {pptxUrl && (
              <a href={pptxUrl} download target="_blank" rel="noopener noreferrer">
                <Button><i className="ri-file-ppt-2-line text-[16px] mr-[6px]"></i> PPTX</Button>
              </a>
            )}
            {pdfUrl && (
              <a href={pdfUrl} download target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><i className="ri-file-pdf-2-line text-[16px] mr-[6px]"></i> PDF</Button>
              </a>
            )}
            <Button variant="outline" onClick={handleGenerate} disabled={generating}>
              <i className="ri-refresh-line text-[16px] mr-[6px]"></i> Regenerate
            </Button>
          </div>
        ) : undefined}
      />

      {error && (
        <div className="mb-[16px] p-[16px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[12px] text-[13px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Pre-generation: Style + Length */}
      {slides.length === 0 && !generating && (
        <div className="space-y-[20px]">
          <Card>
            <CardBody>
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                <i className="ri-palette-line text-lime-500 mr-[6px]"></i> Choose Deck Style
              </h3>
              <p className="text-[13px] text-gray-400 !mb-[16px]">Select a visual style. Each uses different colors, fonts, and layouts.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[12px]">
                {DECK_STYLES.map((style) => (
                  <button key={style.id} onClick={() => setSelectedStyle(style.id)}
                    className={`text-left p-[16px] rounded-[12px] border-2 transition-all ${
                      selectedStyle === style.id ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:shadow-sm"
                    }`}>
                    <div className="flex items-center gap-[10px] mb-[8px]">
                      <div className={`w-[36px] h-[28px] rounded-[6px] ${style.color} flex items-center justify-center flex-none`}>
                        <i className={`${style.icon} text-[14px] ${style.id === "bold" ? "text-white" : "text-gray-500"}`}></i>
                      </div>
                      <span className="text-[14px] font-semibold text-[#06201b] dark:text-white">{style.name}</span>
                      {selectedStyle === style.id && <i className="ri-check-line text-lime-500 text-[16px] ml-auto"></i>}
                    </div>
                    <p className="text-[12px] text-gray-400 !mb-0">{style.desc}</p>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                <i className="ri-slides-line text-lime-500 mr-[6px]"></i> Deck Length
              </h3>
              <p className="text-[13px] text-gray-400 !mb-[16px]">How many slides? AI selects the most relevant content.</p>
              <div className="flex gap-[10px]">
                {[
                  { value: 8, label: "Quick", desc: "Essential slides" },
                  { value: 10, label: "Standard", desc: "Recommended" },
                  { value: 14, label: "Detailed", desc: "Comprehensive" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => setSlideCount(opt.value)}
                    className={`flex-1 p-[16px] rounded-[12px] border-2 text-center transition-all ${
                      slideCount === opt.value ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}>
                    <p className="text-[16px] font-bold text-[#06201b] dark:text-white !mb-[2px]">{opt.value}</p>
                    <p className="text-[12px] font-semibold text-gray-500 !mb-[2px]">{opt.label}</p>
                    <p className="text-[11px] text-gray-400 !mb-0">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          <div className="text-center">
            <Button onClick={handleGenerate} size="lg" className="px-[40px]">
              <i className="ri-magic-line text-[18px] mr-[8px]"></i> Generate Pitch Deck
            </Button>
            <p className="text-[12px] text-gray-400 !mb-0 mt-[8px]">AI creates your deck in 15-30 seconds</p>
          </div>
        </div>
      )}

      {/* Generating */}
      {generating && slides.length === 0 && (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-loader-4-line animate-spin text-lime-600 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">Generating your pitch deck...</h3>
              <p className="text-[14px] text-gray-500 !mb-[12px]">AI is creating slides, writing content, and designing the layout.</p>
              <div className="flex items-center justify-center gap-[6px]">
                <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Results */}
      {slides.length > 0 && (
        <div className="space-y-[20px]">
          <div className="flex items-center gap-[16px] p-[16px] bg-lime-50/50 dark:bg-lime-900/10 rounded-[12px] border border-lime-100 dark:border-lime-800/30">
            <div className="w-[40px] h-[40px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center flex-none">
              <i className="ri-check-line text-lime-600 text-[18px]"></i>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">Deck generated successfully</p>
              <p className="text-[12px] text-gray-400 !mb-0">
                {slides.length} slides · {DECK_STYLES.find((s) => s.id === selectedStyle)?.name || "Investor-First"} style
                {generationTime && ` · ${generationTime}s`}
              </p>
            </div>
            <div className="flex gap-[8px]">
              {pptxUrl && (
                <a href={pptxUrl} download target="_blank" rel="noopener noreferrer">
                  <Button size="sm"><i className="ri-download-line text-[14px] mr-[4px]"></i> PPTX</Button>
                </a>
              )}
              {pdfUrl && (
                <a href={pdfUrl} download target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><i className="ri-file-pdf-2-line text-[14px] mr-[4px]"></i> PDF</Button>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
            {/* Slide List with Drag-and-Drop */}
            <div className="lg:col-span-1 space-y-[6px]">
              <div className="flex items-center justify-between mb-[10px]">
                <h3 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">{slides.length} Slides</h3>
                <span className="text-[11px] text-gray-300 flex items-center gap-[4px]">
                  <i className="ri-draggable text-[12px]"></i> Drag to reorder
                </span>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map((_, i) => `slide-${i}`)} strategy={verticalListSortingStrategy}>
                  {slides.map((slide, index) => (
                    <SortableSlideItem
                      key={`slide-${index}-${slide.title}`}
                      slide={slide}
                      index={index}
                      isSelected={selectedSlide === index}
                      onSelect={() => setSelectedSlide(index)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Slide Preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardBody className="p-0">
                  {slides[selectedSlide] && (
                    <div className="rounded-t-[10px] p-[30px] md:p-[40px] min-h-[400px]"
                      style={{ backgroundColor: design?.backgroundColor || "#FFFFFF", borderBottom: `4px solid ${design?.primaryColor || "#1A237E"}` }}>
                      <div className="flex items-center justify-between mb-[16px]">
                        <Badge variant="default" size="sm">
                          <i className={`${SLIDE_TYPE_ICONS[slides[selectedSlide].type] || "ri-file-line"} mr-[4px]`}></i>
                          {SLIDE_TYPE_LABELS[slides[selectedSlide].type] || slides[selectedSlide].type}
                        </Badge>
                        <div className="flex gap-[6px]">
                          <button onClick={() => startEditSlide(selectedSlide)} className="text-[12px] text-gray-400 hover:text-lime-600 transition-colors">
                            <i className="ri-edit-line mr-[2px]"></i> Edit
                          </button>
                          {slides.length > 3 && (
                            <button onClick={() => deleteSlide(selectedSlide)} className="text-[12px] text-gray-400 hover:text-red-500 transition-colors">
                              <i className="ri-delete-bin-line mr-[2px]"></i> Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {editingSlide === selectedSlide ? (
                        /* Edit Mode */
                        <div className="space-y-[12px]">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-[4px]">Title</label>
                            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full py-[8px] px-[12px] text-[14px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-[4px]">Content</label>
                            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3}
                              className="w-full py-[8px] px-[12px] text-[14px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 resize-none" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-[4px]">Bullets (one per line)</label>
                            <textarea value={editBullets} onChange={(e) => setEditBullets(e.target.value)} rows={4}
                              className="w-full py-[8px] px-[12px] text-[14px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 resize-none" />
                          </div>
                          <div className="flex gap-[8px]">
                            <Button size="sm" onClick={saveEditSlide}><i className="ri-check-line mr-[4px]"></i> Save</Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <>
                          <h2 className="!text-[24px] md:!text-[28px] !font-bold !leading-tight !mb-[16px]"
                            style={{ color: design?.primaryColor || "#1A237E" }}>
                            {slides[selectedSlide].title}
                          </h2>
                          <p className="text-[14px] md:text-[16px] leading-relaxed !mb-[20px]"
                            style={{ color: design?.textColor || "#212121" }}>
                            {slides[selectedSlide].content}
                          </p>
                          {slides[selectedSlide].bullets && slides[selectedSlide].bullets!.length > 0 && (
                            <ul className="space-y-[10px]">
                              {slides[selectedSlide].bullets!.map((bullet, i) => (
                                <li key={i} className="flex items-start gap-[10px] text-[14px]" style={{ color: design?.textColor || "#212121" }}>
                                  <span className="mt-[4px] w-[6px] h-[6px] rounded-full flex-none"
                                    style={{ backgroundColor: design?.accentColor || "#5C6BC0" }}></span>
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          )}
                          {slides[selectedSlide].metrics && slides[selectedSlide].metrics!.length > 0 && (
                            <div className="grid grid-cols-3 gap-[16px] mt-[20px]">
                              {slides[selectedSlide].metrics!.map((metric, i) => (
                                <div key={i} className="text-center p-[16px] bg-gray-50 dark:bg-gray-800/30 rounded-[12px]">
                                  <p className="text-[24px] font-bold !mb-[4px]" style={{ color: design?.primaryColor || "#1A237E" }}>{metric.value}</p>
                                  <p className="text-[12px] text-gray-400 !mb-0">{metric.label}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <div className="p-[16px] flex items-center justify-between">
                    <span className="text-[12px] text-gray-400">Slide {selectedSlide + 1} of {slides.length}</span>
                    <div className="flex gap-[8px]">
                      <Button variant="outline" size="sm" onClick={() => setSelectedSlide(Math.max(0, selectedSlide - 1))} disabled={selectedSlide === 0}>
                        <i className="ri-arrow-left-line"></i>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedSlide(Math.min(slides.length - 1, selectedSlide + 1))} disabled={selectedSlide === slides.length - 1}>
                        <i className="ri-arrow-right-line"></i>
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
