"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

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
  cover: "ri-megaphone-line",
  problem: "ri-error-warning-line",
  solution: "ri-lightbulb-line",
  market: "ri-bar-chart-grouped-line",
  product: "ri-box-3-line",
  traction: "ri-line-chart-line",
  business_model: "ri-money-dollar-circle-line",
  competition: "ri-sword-line",
  team: "ri-team-line",
  ask: "ri-hand-coin-line",
  vision: "ri-eye-line",
};

const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "Cover",
  problem: "Problem",
  solution: "Solution",
  market: "Market",
  product: "Product",
  traction: "Traction",
  business_model: "Business Model",
  competition: "Competition",
  team: "Team",
  ask: "The Ask",
  vision: "Vision",
};

const DECK_STYLES = [
  { id: "investor", name: "Investor-First", desc: "Data-heavy, metrics-focused, no fluff", icon: "ri-line-chart-line", color: "bg-gray-50 border-gray-300" },
  { id: "minimal", name: "Minimal", desc: "Clean lines, white space, focused", icon: "ri-layout-line", color: "bg-white border-gray-200" },
  { id: "bold", name: "Bold", desc: "Strong colors, high contrast", icon: "ri-fire-line", color: "bg-[#06201b] text-white" },
  { id: "corporate", name: "Corporate", desc: "Professional, structured, trustworthy", icon: "ri-briefcase-line", color: "bg-blue-50 border-blue-200" },
  { id: "modern", name: "Modern", desc: "Gradient accents, smooth transitions", icon: "ri-sparkling-2-line", color: "bg-gradient-to-br from-purple-50 to-blue-50" },
];

export default function NewDeckPage() {
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [design, setDesign] = useState<DesignDirection | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState("investor");
  const [slideCount, setSlideCount] = useState(10);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  const checkProfile = useCallback(async () => {
    try {
      const { getOrCreateCompanyProfile } = await import("@/lib/actions/company");
      const profile = await getOrCreateCompanyProfile();
      if (profile && profile.onboardingCompleted) {
        setProfileReady(true);
        setCompanyName(profile.companyName || "Your Company");
      }
    } catch {
      // No profile
    }
  }, []);

  useEffect(() => { checkProfile(); }, [checkProfile]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const startTime = Date.now();

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in to generate a deck");
        setGenerating(false);
        return;
      }

      const response = await fetch("/api/deck/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, style: selectedStyle, slideCount }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      setSlides(data.slides || []);
      setDesign(data.designDirection);
      setFileUrl(data.fileUrl);
      setFileName(data.fileName);
      setGenerationTime(Math.round((Date.now() - startTime) / 1000));
      setSelectedSlide(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
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
            <Link href="/onboarding">
              <Button>Complete Onboarding</Button>
            </Link>
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
        actions={
          slides.length > 0 ? (
            <div className="flex items-center gap-[10px]">
              {fileUrl && (
                <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                  <Button>
                    <i className="ri-download-line text-[16px] mr-[6px]"></i>
                    Download PPTX
                  </Button>
                </a>
              )}
              <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                <i className="ri-refresh-line text-[16px] mr-[6px]"></i>
                Regenerate
              </Button>
            </div>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-[16px] p-[14px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[10px] text-[13px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Pre-generation: Style Selection */}
      {slides.length === 0 && !generating && (
        <div className="space-y-[20px]">
          <Card>
            <CardBody>
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                <i className="ri-palette-line text-lime-500 mr-[6px]"></i>
                Choose Deck Style
              </h3>
              <p className="text-[13px] text-gray-400 !mb-[16px]">
                Select a visual style for your pitch deck. Each style uses different color palettes and layouts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[12px]">
                {DECK_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`text-left p-[16px] rounded-[12px] border-2 transition-all ${
                      selectedStyle === style.id
                        ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-[10px] mb-[8px]">
                      <div className={`w-[36px] h-[28px] rounded-[6px] ${style.color} flex items-center justify-center flex-none`}>
                        <i className={`${style.icon} text-[14px] ${style.id === "bold" ? "text-white" : "text-gray-500"}`}></i>
                      </div>
                      <div className="flex-1">
                        <span className="text-[14px] font-semibold text-[#06201b] dark:text-white">{style.name}</span>
                      </div>
                      {selectedStyle === style.id && (
                        <i className="ri-check-line text-lime-500 text-[16px]"></i>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-400 !mb-0">{style.desc}</p>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Slide Count */}
          <Card>
            <CardBody>
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                <i className="ri-slides-line text-lime-500 mr-[6px]"></i>
                Deck Length
              </h3>
              <p className="text-[13px] text-gray-400 !mb-[16px]">
                Choose how many slides to include. AI will select the most relevant content.
              </p>
              <div className="flex gap-[10px]">
                {[
                  { value: 8, label: "Quick", desc: "Essential slides only" },
                  { value: 10, label: "Standard", desc: "Recommended for most decks" },
                  { value: 14, label: "Detailed", desc: "Comprehensive with extra context" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSlideCount(opt.value)}
                    className={`flex-1 p-[14px] rounded-[10px] border-2 text-center transition-all ${
                      slideCount === opt.value
                        ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-[16px] font-bold text-[#06201b] dark:text-white !mb-[2px]">{opt.value}</p>
                    <p className="text-[12px] font-semibold text-gray-500 !mb-[2px]">{opt.label}</p>
                    <p className="text-[11px] text-gray-400 !mb-0">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Generate Button */}
          <div className="text-center">
            <Button onClick={handleGenerate} size="lg" className="px-[40px]">
              <i className="ri-magic-line text-[18px] mr-[8px]"></i>
              Generate Pitch Deck
            </Button>
            <p className="text-[12px] text-gray-400 !mb-0 mt-[8px]">
              AI will create your deck in 15-30 seconds
            </p>
          </div>
        </div>
      )}

      {/* Generating State */}
      {generating && slides.length === 0 && (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-loader-4-line animate-spin text-lime-600 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">Generating your pitch deck...</h3>
              <p className="text-[14px] text-gray-500 !mb-[12px]">
                AI is creating your slides, writing content, and designing the layout.
              </p>
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
          {/* Generation Summary */}
          <div className="flex items-center gap-[16px] p-[14px] bg-lime-50/50 dark:bg-lime-900/10 rounded-[10px] border border-lime-100 dark:border-lime-800/30">
            <div className="w-[40px] h-[40px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center flex-none">
              <i className="ri-check-line text-lime-600 text-[18px]"></i>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                Deck generated successfully
              </p>
              <p className="text-[12px] text-gray-400 !mb-0">
                {slides.length} slides · {DECK_STYLES.find((s) => s.id === selectedStyle)?.name || "Investor-First"} style
                {generationTime && ` · Generated in ${generationTime}s`}
              </p>
            </div>
            {fileUrl && (
              <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                <Button size="sm">
                  <i className="ri-download-line text-[14px] mr-[4px]"></i>
                  Download
                </Button>
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
            {/* Slide List */}
            <div className="lg:col-span-1 space-y-[6px]">
              <h3 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider mb-[10px]">
                {slides.length} Slides
              </h3>
              {slides.map((slide, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedSlide(index)}
                  className={`w-full text-left p-[12px] rounded-[10px] transition-all ${
                    selectedSlide === index
                      ? "bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800"
                      : "bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-[10px]">
                    <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center flex-none text-[11px] font-bold ${
                      selectedSlide === index
                        ? "bg-lime-500 text-black"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">
                        {slide.title}
                      </p>
                      <p className="text-[11px] text-gray-400 !mb-0">
                        {SLIDE_TYPE_LABELS[slide.type] || slide.type}
                      </p>
                    </div>
                    <i className={`${SLIDE_TYPE_ICONS[slide.type] || "ri-file-line"} text-[14px] ${
                      selectedSlide === index ? "text-lime-500" : "text-gray-300"
                    }`}></i>
                  </div>
                </button>
              ))}
            </div>

            {/* Slide Preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardBody className="p-0">
                  {slides[selectedSlide] && (
                    <div
                      className="rounded-t-[10px] p-[30px] md:p-[40px] min-h-[400px]"
                      style={{
                        backgroundColor: design?.backgroundColor || "#FFFFFF",
                        borderBottom: `4px solid ${design?.primaryColor || "#1A237E"}`,
                      }}
                    >
                      {/* Slide Type Badge */}
                      <div className="mb-[16px]">
                        <Badge variant="default" size="sm">
                          <i className={`${SLIDE_TYPE_ICONS[slides[selectedSlide].type] || "ri-file-line"} mr-[4px]`}></i>
                          {SLIDE_TYPE_LABELS[slides[selectedSlide].type] || slides[selectedSlide].type}
                        </Badge>
                      </div>

                      {/* Slide Title */}
                      <h2
                        className="!text-[24px] md:!text-[30px] !font-bold !leading-tight !mb-[16px]"
                        style={{ color: design?.primaryColor || "#1A237E" }}
                      >
                        {slides[selectedSlide].title}
                      </h2>

                      {/* Slide Content */}
                      <p
                        className="text-[15px] md:text-[16px] leading-relaxed !mb-[20px]"
                        style={{ color: design?.textColor || "#212121" }}
                      >
                        {slides[selectedSlide].content}
                      </p>

                      {/* Bullets */}
                      {slides[selectedSlide].bullets && slides[selectedSlide].bullets!.length > 0 && (
                        <ul className="space-y-[10px]">
                          {slides[selectedSlide].bullets!.map((bullet, i) => (
                            <li key={i} className="flex items-start gap-[10px] text-[14px]" style={{ color: design?.textColor || "#212121" }}>
                              <span className="mt-[3px] w-[6px] h-[6px] rounded-full flex-none" style={{ backgroundColor: design?.accentColor || "#5C6BC0" }}></span>
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Metrics */}
                      {slides[selectedSlide].metrics && slides[selectedSlide].metrics!.length > 0 && (
                        <div className="grid grid-cols-3 gap-[16px] mt-[20px]">
                          {slides[selectedSlide].metrics!.map((metric, i) => (
                            <div key={i} className="text-center p-[16px] bg-gray-50 dark:bg-gray-800/30 rounded-[10px]">
                              <p className="text-[24px] font-bold !mb-[4px]" style={{ color: design?.primaryColor || "#1A237E" }}>
                                {metric.value}
                              </p>
                              <p className="text-[12px] text-gray-400 !mb-0">{metric.label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Slide Footer */}
                  <div className="p-[16px] flex items-center justify-between">
                    <span className="text-[12px] text-gray-400">
                      Slide {selectedSlide + 1} of {slides.length}
                    </span>
                    <div className="flex gap-[8px]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSlide(Math.max(0, selectedSlide - 1))}
                        disabled={selectedSlide === 0}
                      >
                        <i className="ri-arrow-left-line"></i>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSlide(Math.min(slides.length - 1, selectedSlide + 1))}
                        disabled={selectedSlide === slides.length - 1}
                      >
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
