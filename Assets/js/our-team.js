document.addEventListener("DOMContentLoaded", async function () {
    const headingForm = document.getElementById("headingForm");
    const uploadForm = document.getElementById("uploadForm");
    const editHeadingForm = document.getElementById("editHeadingForm");
    const editForm = document.getElementById("editForm");

    const headingTable = document.querySelector("#headingTable tbody");
    const teamTable = document.querySelector("#teamTable tbody");

    const teamHeadingInput = document.getElementById("teamHeadingInput");
    const editTeamHeading = document.getElementById("editTeamHeading");

    if (!window.supabase) {
        alert("Supabase is not loaded. Please check superbase.js file.");
        return;
    }

    function getErrorMessage(err) {
        return (
            err?.message ||
            err?.details ||
            err?.hint ||
            err?.error_description ||
            JSON.stringify(err)
        );
    }

    function escapeHTML(value = "") {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function uploadImage(file) {
        try {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

            updateProgressBar(20);

            const { error } = await window.supabase.storage
                .from("team-images")
                .upload(fileName, file, {
                    cacheControl: "3600",
                    upsert: true
                });

            if (error) throw error;

            updateProgressBar(70);

            const { data } = window.supabase.storage
                .from("team-images")
                .getPublicUrl(fileName);

            return data.publicUrl;
        } catch (error) {
            console.error("Upload error:", error);
            throw error;
        }
    }

    async function loadHeadings() {
        try {
            const { data, error } = await window.supabase
                .from("team_headings")
                .select("*")
                .order("created_at", { ascending: true });

            if (error) throw error;

            const headings = data || [];

            if (headings.length === 0) {
                headingTable.innerHTML = `
                    <tr>
                        <td colspan="2" class="text-center text-muted">
                            No headings added yet.
                        </td>
                    </tr>
                `;
            } else {
                headingTable.innerHTML = headings.map((heading) => `
                    <tr>
                        <td>${escapeHTML(heading.heading_name)}</td>
                        <td>
                            <button class="btn btn-sm btn-warning me-1" onclick="editHeading(${heading.id})">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteHeading(${heading.id})">
                                Delete
                            </button>
                        </td>
                    </tr>
                `).join("");
            }

            const headingOptions = headings.map((heading) => `
                <option value="${heading.id}">
                    ${escapeHTML(heading.heading_name)}
                </option>
            `).join("");

            if (teamHeadingInput) {
                teamHeadingInput.innerHTML = `
                    <option value="">Select Heading</option>
                    ${headingOptions}
                `;
            }

            if (editTeamHeading) {
                editTeamHeading.innerHTML = `
                    <option value="">Select Heading</option>
                    ${headingOptions}
                `;
            }
        } catch (err) {
            console.error("Load headings error:", err);
            showToast("Failed to load headings: " + getErrorMessage(err), false);
        }
    }

    if (headingForm) {
        headingForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const headingInput = document.getElementById("headingInput");
            const headingName = headingInput.value.trim();

            if (!headingName) {
                showToast("Please enter heading name", false);
                return;
            }

            try {
                const { error } = await window.supabase
                    .from("team_headings")
                    .insert([
                        {
                            heading_name: headingName
                        }
                    ]);

                if (error) throw error;

                showToast("Heading added successfully!");
                headingForm.reset();

                await loadHeadings();
            } catch (err) {
                console.error("Add heading error:", err);
                showToast("Failed to add heading: " + getErrorMessage(err), false);
            }
        });
    }

    window.editHeading = async function (id) {
        try {
            const { data: heading, error } = await window.supabase
                .from("team_headings")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;

            document.getElementById("editHeadingId").value = heading.id;
            document.getElementById("editHeadingName").value = heading.heading_name || "";

            new bootstrap.Modal(document.getElementById("editHeadingModal")).show();
        } catch (err) {
            console.error("Edit heading load error:", err);
            showToast("Failed to load heading: " + getErrorMessage(err), false);
        }
    };

    if (editHeadingForm) {
        editHeadingForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const id = document.getElementById("editHeadingId").value;
            const headingName = document.getElementById("editHeadingName").value.trim();

            if (!headingName) {
                showToast("Please enter heading name", false);
                return;
            }

            try {
                const { error } = await window.supabase
                    .from("team_headings")
                    .update({
                        heading_name: headingName
                    })
                    .eq("id", id);

                if (error) throw error;

                showToast("Heading updated successfully!");

                const modal = bootstrap.Modal.getInstance(document.getElementById("editHeadingModal"));
                if (modal) modal.hide();

                await loadHeadings();
                await loadTeamMembers();
            } catch (err) {
                console.error("Update heading error:", err);
                showToast("Failed to update heading: " + getErrorMessage(err), false);
            }
        });
    }

    window.deleteHeading = async function (id) {
        if (!confirm("Are you sure you want to delete this heading?")) return;

        try {
            const { data: members, error: memberError } = await window.supabase
                .from("team_members")
                .select("id")
                .eq("heading_id", id);

            if (memberError) throw memberError;

            if (members && members.length > 0) {
                showToast("This heading has team members. Please delete or move them first.", false);
                return;
            }

            const { error } = await window.supabase
                .from("team_headings")
                .delete()
                .eq("id", id);

            if (error) throw error;

            showToast("Heading deleted successfully!");
            await loadHeadings();
        } catch (err) {
            console.error("Delete heading error:", err);
            showToast("Failed to delete heading: " + getErrorMessage(err), false);
        }
    };

    async function loadTeamMembers() {
        try {
            const { data, error } = await window.supabase
                .from("team_members")
                .select(`
                    *,
                    team_headings (
                        heading_name
                    )
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const members = data || [];

            if (members.length === 0) {
                teamTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">
                            No team members added yet.
                        </td>
                    </tr>
                `;
                return;
            }

            teamTable.innerHTML = members.map((member) => {
                const shortDesc = member.short_description || "";
                const shortPreview =
                    shortDesc.length > 80
                        ? shortDesc.substring(0, 80) + "..."
                        : shortDesc || "-";

                return `
                    <tr>
                        <td>
                            <img
                                src="${escapeHTML(member.image_url || "")}"
                                alt="${escapeHTML(member.name || "Team Member")}"
                                style="width: 100px; height: 100px; object-fit: cover;"
                            >
                        </td>
                        <td>${escapeHTML(member.team_headings?.heading_name || "-")}</td>
                        <td>${escapeHTML(member.name || "-")}</td>
                        <td>${escapeHTML(member.designation || "-")}</td>
                        <td>
                            <span class="badge ${member.status === "active" ? "bg-success" : "bg-secondary"}">
                                ${escapeHTML(member.status || "inactive")}
                            </span>
                        </td>
                        <td>${escapeHTML(shortPreview)}</td>
                        <td>
                            <button class="btn btn-sm btn-warning me-1" onclick="editMember(${member.id})">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteMember(${member.id})">
                                Delete
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");
        } catch (err) {
            console.error("Load members error:", err);
            showToast("Failed to load team members: " + getErrorMessage(err), false);
        }
    }

    if (uploadForm) {
        uploadForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;

            try {
                const headingId = document.getElementById("teamHeadingInput").value;
                const imageFile = document.getElementById("imageInput").files[0];
                const name = document.getElementById("nameInput").value.trim();
                const designation = document.getElementById("designationInput").value.trim();
                const status = document.getElementById("statusInput").value;
                const shortDescription = document.getElementById("shortDescriptionInput").value.trim();
                const longDescription = document.getElementById("longDescriptionInput").value.trim();

                if (!headingId || !imageFile || !name || !designation || !status) {
                    throw new Error("Please fill heading, image, name, designation and status.");
                }

                const imageUrl = await uploadImage(imageFile);
                updateProgressBar(85);

                const { error } = await window.supabase
                    .from("team_members")
                    .insert([
                        {
                            heading_id: Number(headingId),
                            image_url: imageUrl,
                            name: name,
                            designation: designation,
                            status: status,
                            short_description: shortDescription || null,
                            long_description: longDescription || null
                        }
                    ]);

                if (error) throw error;

                showToast("Team member added successfully!");
                uploadForm.reset();
                updateProgressBar(100);

                await loadTeamMembers();

                setTimeout(() => updateProgressBar(0), 1000);
            } catch (err) {
                console.error("Add member error:", err);
                showToast(getErrorMessage(err) || "Failed to add team member", false);
                updateProgressBar(0);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    window.deleteMember = async function (id) {
        if (!confirm("Are you sure you want to delete this team member?")) return;

        try {
            const { data: member, error: fetchError } = await window.supabase
                .from("team_members")
                .select("image_url")
                .eq("id", id)
                .single();

            if (fetchError) throw fetchError;

            const { error } = await window.supabase
                .from("team_members")
                .delete()
                .eq("id", id);

            if (error) throw error;

            if (member?.image_url) {
                const fileName = decodeURIComponent(member.image_url.split("/").pop());

                await window.supabase.storage
                    .from("team-images")
                    .remove([fileName]);
            }

            showToast("Team member deleted successfully!");
            await loadTeamMembers();
        } catch (err) {
            console.error("Delete member error:", err);
            showToast("Failed to delete team member: " + getErrorMessage(err), false);
        }
    };

    window.editMember = async function (id) {
        try {
            await loadHeadings();

            const { data: member, error } = await window.supabase
                .from("team_members")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;

            document.getElementById("editId").value = member.id;
            document.getElementById("editTeamHeading").value = member.heading_id || "";
            document.getElementById("editName").value = member.name || "";
            document.getElementById("editDesignation").value = member.designation || "";
            document.getElementById("editStatus").value = member.status || "active";
            document.getElementById("editShortDescription").value = member.short_description || "";
            document.getElementById("editLongDescription").value = member.long_description || "";
            document.getElementById("editImage").value = "";

            new bootstrap.Modal(document.getElementById("editModal")).show();
        } catch (err) {
            console.error("Edit member load error:", err);
            showToast("Failed to load team member: " + getErrorMessage(err), false);
        }
    };

    if (editForm) {
        editForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;

            try {
                const id = document.getElementById("editId").value;
                const headingId = document.getElementById("editTeamHeading").value;
                const name = document.getElementById("editName").value.trim();
                const designation = document.getElementById("editDesignation").value.trim();
                const status = document.getElementById("editStatus").value;
                const shortDescription = document.getElementById("editShortDescription").value.trim();
                const longDescription = document.getElementById("editLongDescription").value.trim();

                if (!headingId || !name || !designation || !status) {
                    throw new Error("Please fill heading, name, designation and status.");
                }

                const updates = {
                    heading_id: Number(headingId),
                    name: name,
                    designation: designation,
                    status: status,
                    short_description: shortDescription || null,
                    long_description: longDescription || null
                };

                const imageFile = document.getElementById("editImage").files[0];

                if (imageFile) {
                    updates.image_url = await uploadImage(imageFile);
                }

                const { error } = await window.supabase
                    .from("team_members")
                    .update(updates)
                    .eq("id", id);

                if (error) throw error;

                showToast("Team member updated successfully!");

                const modal = bootstrap.Modal.getInstance(document.getElementById("editModal"));
                if (modal) modal.hide();

                await loadTeamMembers();
            } catch (err) {
                console.error("Update member error:", err);
                showToast("Failed to update team member: " + getErrorMessage(err), false);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    function updateProgressBar(percent) {
        const progress = document.getElementById("uploadProgress");
        if (!progress) return;

        progress.style.width = percent + "%";
        progress.textContent = percent ? percent + "%" : "";
    }

    function showToast(message, success = true) {
        const toastEl = document.getElementById("uploadToast");
        const toastMsg = document.getElementById("toastMessage");

        if (!toastEl || !toastMsg) {
            alert(message);
            return;
        }

        toastMsg.textContent = message;

        toastEl.classList.remove("bg-success", "bg-danger");
        toastEl.classList.add(success ? "bg-success" : "bg-danger");

        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    await loadHeadings();
    await loadTeamMembers();
});