// ==========================================
// NEXUS GLOBAL SEARCH
// ==========================================

const searchInput =
    document.getElementById("globalSearchInput");

const searchResults =
    document.getElementById("searchResults");

let searchTimeout = null;


// ==========================================
// PERFORM SEARCH
// ==========================================

async function performSearch(query) {

    const token =
        localStorage.getItem("nexusToken");

    if (!token) return;

    try {

        const response = await fetch(
            `/api/search?q=${encodeURIComponent(query)}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const data =
            await response.json();

        if (!data.success) {
            return;
        }

        renderSearchResults(data);

    } catch (error) {

        console.error(
            "Search error:",
            error
        );

    }
}


// ==========================================
// RENDER RESULTS
// ==========================================

function renderSearchResults(data) {

    const users =
        data.users || [];

    const communities =
        data.communities || [];

    const projects =
        data.projects || [];


    const totalResults =
        users.length +
        communities.length +
        projects.length;


    if (totalResults === 0) {

        searchResults.innerHTML = `
            <div class="search-empty">
                No results found
            </div>
        `;

        searchResults.classList.add("active");

        return;
    }


    let html = "";


    // ======================================
    // PEOPLE
    // ======================================

    if (users.length > 0) {

        html += `
            <div class="search-section-title">
                People
            </div>
        `;

        users.forEach(user => {

            html += `
                <div
                    class="search-result"
                    data-type="user"
                    data-id="${user.id}"
                >

                    <div class="search-result-icon">
                        👤
                    </div>

                    <div class="search-result-info">

                        <div class="search-result-name">
                            ${escapeHTML(
                                user.name ||
                                user.username
                            )}
                        </div>

                        <div class="search-result-description">
                            @${escapeHTML(
                                user.username
                            )}
                        </div>

                    </div>

                </div>
            `;

        });
    }


    // ======================================
    // COMMUNITIES
    // ======================================

    if (communities.length > 0) {

        html += `
            <div class="search-section-title">
                Communities
            </div>
        `;

        communities.forEach(community => {

            html += `
                <div
                    class="search-result"
                    data-type="community"
                    data-id="${community.id}"
                >

                    <div class="search-result-icon">
                        👥
                    </div>

                    <div class="search-result-info">

                        <div class="search-result-name">
                            ${escapeHTML(
                                community.name
                            )}
                        </div>

                        <div class="search-result-description">
                            ${escapeHTML(
                                community.category ||
                                "Community"
                            )}
                        </div>

                    </div>

                </div>
            `;

        });
    }


    // ======================================
    // PROJECTS
    // ======================================

    if (projects.length > 0) {

        html += `
            <div class="search-section-title">
                Projects
            </div>
        `;

        projects.forEach(project => {

            html += `
                <div
                    class="search-result"
                    data-type="project"
                    data-id="${project.id}"
                >

                    <div class="search-result-icon">
                        🚀
                    </div>

                    <div class="search-result-info">

                        <div class="search-result-name">
                            ${escapeHTML(
                                project.name
                            )}
                        </div>

                        <div class="search-result-description">
                            ${escapeHTML(
                                project.status ||
                                "Project"
                            )}
                        </div>

                    </div>

                </div>
            `;

        });
    }


    searchResults.innerHTML = html;

    searchResults.classList.add("active");


    // ======================================
    // RESULT CLICK
    // ======================================

    document
        .querySelectorAll(".search-result")
        .forEach(result => {

            result.addEventListener(
                "click",
                () => {

                    const type =
                        result.dataset.type;

                    const id =
                        result.dataset.id;

                    handleSearchResult(
                        type,
                        id
                    );

                }
            );

        });

}


// ==========================================
// RESULT NAVIGATION
// ==========================================

function handleSearchResult(type, id) {
    if (type === "community") {
        window.location.href =
            `/communities.html?communityId=${encodeURIComponent(id)}`;
        return;
    }

    if (type === "project") {
        window.location.href =
            `/projects.html?projectId=${encodeURIComponent(id)}`;
        return;
    }

    if (type === "user") {
        window.location.href =
            `/profile.html?userId=${encodeURIComponent(id)}`;
    }
}



// ==========================================
// SEARCH INPUT
// ==========================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            const query =
                searchInput.value.trim();


            clearTimeout(
                searchTimeout
            );


            if (!query) {

                searchResults.classList.remove(
                    "active"
                );

                return;
            }


            searchTimeout =
                setTimeout(
                    () => {
                        performSearch(query);
                    },
                    300
                );

        }
    );

}


// ==========================================
// CLOSE RESULTS
// ==========================================

document.addEventListener(
    "click",
    (event) => {

        if (
            !event.target.closest(
                ".search-box"
            )
        ) {

            searchResults?.classList.remove(
                "active"
            );

        }

    }
);


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}