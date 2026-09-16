import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // Adjust to "../lib/supabase" if App.tsx is inside src/app/

// ── Inside Facilitator App / Component ──

export default function FacilitatorApp() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venue, setVenue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [regLink, setRegLink] = useState("");
  const [qrFile, setQrFile] = useState("");
  const [apfFile, setApfFile] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Submitted Events from Database
  const fetchMyEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching events:", error.message);
    } else if (data) {
      setEvents(data);
    }
    setLoading(false);
  };

  // 2. Realtime Listener: Updates status immediately when Admin approves/rejects
  useEffect(() => {
    fetchMyEvents();

    const channel = supabase
      .channel("facilitator-events-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          fetchMyEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Submit Event to Database (Reflects in Admin Queue)
  const handleSubmit = async () => {
    setSubmitting(true);

    // Payload formatted for the Supabase schema
    const payload = {
      title,
      event_date: date,
      start_time: startTime,
      end_time: endTime,
      venue,
      description,
      tags: selectedTags.length > 0 ? selectedTags : ["Campus Event"],
      status: "pending",
      registration_link: regLink || null,
      has_qr_code: !!qrFile,
      organization: "CS Society", // Dynamically inject logged-in org if available
    };

    // Insert into 'events' table
    const { data: createdEvent, error: eventError } = await supabase
      .from("events")
      .insert([payload])
      .select()
      .single();

    if (eventError) {
      console.error("Failed to submit event:", eventError.message);
      setSubmitting(false);
      return;
    }

    // Insert into 'event_clearances' table if APF document was uploaded
    if (apfFile && createdEvent) {
      await supabase.from("event_clearances").insert([
        {
          event_id: createdEvent.id,
          document_type: "apf",
          document_url: apfFile, // Uploaded storage URL or filename
          status: "verified",
        },
      ]);
    }

    setSubmitting(false);

    // Reset Form & reload list
    setTitle("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setVenue("");
    setDescription("");
    setSelectedTags([]);
    setRegLink("");
    setQrFile("");
    setApfFile("");
    
    await fetchMyEvents();
  };

  // 4. Submit Narrative Report Post-Event
  const handleNarrativeSubmit = async (
    eventId: number,
    fileUrl: string,
    registrations: number,
    attendance: number
  ) => {
    const { error } = await supabase.from("narrative_reports").insert([
      {
        event_id: eventId,
        total_registrations: registrations,
        actual_attendance: attendance,
        narrative_file_url: fileUrl,
      },
    ]);

    if (!error) {
      // Mark event as completed
      await supabase
        .from("events")
        .update({ status: "completed" })
        .eq("id", eventId);
      
      await fetchMyEvents();
    }
  };

  return (
    <div>
      {/* Attach handleSubmit to your Submit Button */}
      {/* Render events list mapping over `events` array */}
    </div>
  );
}