var app = angular.module("agentyChromeApp", [
  "alexjoffroy.angular-loaders",
  "toastr",
  "ngSanitize",
]);

app.controller(
  "agentyChromeController",
  function ($scope, $http, $timeout, toastr) {
    $scope.version = 1;
    $scope.domain = "agenty.com";
    $scope.apiBaseURL = `https://api.agenty.com/v2`;
    $scope.appBaseURL = `https://cloud.agenty.com`;
    $scope.autoStart = true;

    $scope.agent = {};
    $scope.results = [];
    $scope.warningMessage = "";
    $scope.errorMessage = "";
    $scope.successMessage = "";
    $scope.apiKey = "";
    $scope.loading = {};
    $scope.fieldSequence = [];
    $scope.selectingFieldIndex = null;

    $scope.panel = "home";
    $scope.modal = "";
    $scope.nextModal = "";
    $scope.draft;

    $scope.initSideBar = function () {
      $scope.user = store.get("authUser");
      $scope.email = store.get("authEmail");
      $scope.envChange(
        store.get("domain") == "agenty.in" ? "agenty.in" : $scope.domain
      );
      // If draft is 15m old
      const draft = store.get("agentDraft");
      if (draft && draft.created_at) {
        const minutesOld = $scope.getMinutes(
          new Date(draft.created_at),
          new Date()
        );
        if (minutesOld <= 15) {
          $scope.draft = draft;
        }
      }
    };

    $scope.envChange = function (d) {
      if (!d) return;
      $scope.apiBaseURL = `https://api.${d}/v2`;
      $scope.appBaseURL = `https://cloud.${d}`;
      $scope.domain = d;
    };

    $scope.openDraft = function () {
      $scope.agent = $scope.draft;
      $scope.panel = $scope.agent.type;

      if ($scope.agent.config && $scope.agent.config.collections?.length) {
        $scope.selectedCollection = $scope.agent.config.collections[0];
      }
    };

    $scope.cancelDraft = function () {
      $scope.draft = undefined;
      store.remove("agentDraft");
    };

    $scope.back = function () {
      $scope.panel = "home";
    };

    $scope.getMinutes = function (startDate, endDate) {
      var diff = endDate.getTime() - startDate.getTime();
      return diff / 60000;
    };

    $scope.initScrapingAgent = function () {
      $scope.panel = "scraping";
      var userLanguage =
        window.navigator.userLanguage || window.navigator.language || "*";
      var referrerHeader =
        window.location != window.parent.location
          ? document.referrer
          : document.location.href;

      $scope.agent = {
        created_at: new Date(),
        agent_id: null,
        project_id: null,
        name: "",
        description: null,
        type: "scraping",
        tags: [],
        config: {
          url: "",
          collections: [
            {
              name: "Collection1",
              fields: [],
            },
          ],
          wait_for: {
            type: "selector",
            timeout: 5000,
            value: null,
          },
          go_to_options: {
            timeout: 30000,
            wait_until: ["networkidle2"],
            referer: referrerHeader,
          },
          pagination: {
            enabled: false,
            type: null,
            value: null,
            container: null,
            max_pages: 10,
          },
          login: {
            enabled: false,
            actions: [],
          },
          logout: {
            enabled: false,
            actions: [],
          },
          form: {
            enabled: false,
            actions: [],
          },
          headers: [],
          browser: "agenty",
          user_agent: navigator.userAgent,
          block_ads: true,
          block_trackers: true,
          lazy_load: false,
          set_javascript_enabled: true,
          reject_resource_types: [],
          reject_request_pattern: [],
          device: null,
          viewport: {
            width: 1536,
            height: 754,
          },
          anonymous: {
            proxy: true,
            proxy_type: "default",
            country: null,
            skip_resource_types: [],
          },
          retry: {
            enabled: true,
            maxtry: 3,
            tryinterval: 2,
          },
        },
      };

      // Update the source url and agent name
      $scope.updateSourceURL();

      // Set the 1st collection as selectedCollection
      if (!$scope.selectedCollection) {
        $scope.selectedCollection = $scope.agent.config.collections[0];
      }
    };

    $scope.initChangeDetectionAgent = function () {
      $scope.panel = "changedetection";
      $scope.agent = {
        created_at: new Date(),
        agent_id: null,
        project_id: null,
        name: "",
        description: null,
        type: "changedetection",
        tags: [],
        scheduler: null,
        config: {
          url: null,
          timeout: 30000,
          type: "CSS",
          selector: null,
          extract: "HTML",
          attribute: null,
          ignore_minor_changes: true,
          keywords: [],
          keywords_change: "Added",
          emails: $scope.email,
        },
      };

      // Update the source url and name of agent
      $scope.updateSourceURL();
      $scope.agent.config.resultsShown = true;
    };

    $scope.initCrawlingAgent = function () {
      $scope.panel = "crawling";
      var userLanguage =
        window.navigator.userLanguage || window.navigator.language || "*";
      var referrerHeader =
        window.location != window.parent.location
          ? document.referrer
          : document.location.href;
      $scope.agent = {
        created_at: new Date(),
        agent_id: null,
        project_id: null,
        name: "",
        description: null,
        type: "crawling",
        tags: null,
        config: {
          url: "",
          collections: [
            {
              name: "Collection1",
              fields: [],
              from: null,
            },
          ],
          max_depth_to_crawl: 3,
          max_time_to_crawl: 300,
          max_pages_to_crawl: 100,
          max_link_per_page: 5000,
          max_error_threshold: 5,
          follow_sitemaps: true,
          follow_external_links: false,
          should_crawl_external_pages: false,
          should_crawl_internal_pages: true,
          keep_cookies: false,
          crawl_rules: [],
          processing_rules: [],
          priority_rules: [],
          respect_robots_txt: true,
          respect_rel_nofollow: true,
          headers: [
            {
              key: "Accept",
              value:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            },
            {
              key: "User-Agent",
              value: navigator.userAgent,
            },
            {
              key: "Accept-Language",
              value: userLanguage + ",en;q=0.9",
            },
          ],
          anonymous: {
            proxy: true,
            proxy_type: "default",
            country: null,
            skip_resource_types: [],
          },
        },
      };

      // Update the source url and agent name
      $scope.updateSourceURL();

      // Set the 1st collection as selectedCollection
      if (!$scope.selectedCollection) {
        $scope.selectedCollection = $scope.agent.config.collections[0];
      }

      // Add referrer header if any
      if (referrerHeader) {
        $scope.agent.config.headers.push({
          key: "Referrer",
          value: referrerHeader,
        });
      }
    };

    // Unsaved draft
    $scope.$watch(
      "agent",
      function (newVal, oldVal) {
        // Keep on local storage until saved to Agenty cloud
        if (
          newVal &&
          (newVal.type == "scraping" || newVal.type == "crawling")
        ) {
          store.set("agentDraft", newVal);
        }
      },
      true
    );

    $scope.addField = function () {
      if (!$scope.selectedCollection) {
        $scope.selectedCollection = $scope.agent.config.collections[0];
      }
      if (!$scope.selectedCollection.fieldSeq) {
        $scope.selectedCollection.fieldSeq =
          $scope.selectedCollection.fields.length + 1;
      }
      var field = {
        name: "Field" + $scope.selectedCollection.fieldSeq++,
        type: "CSS",
        selector: "",
        extract: "HTML",
        attribute: null,
        from: null,
        join: false,
        postprocessing: [],
        results: [],
        resultsShown: true,
        xpaths: [],
      };

      if ($scope.selectedCollection.fields.length < 120) {
        $scope.selectedCollection.fields.push(field);
      } else {
        alert("Error: Cannot add more then 120 fields");
      }
    };

    $scope.addCollection = function () {
      collection = {
        name: "Collection" + ($scope.agent.config.collections.length + 1),
        fields: [],
      };
      if ($scope.agent.config.collections.length < 10) {
        $scope.agent.config.collections.push(collection);
        $scope.selectedCollection = collection;
      } else {
        alert("Error: Cannot add more then 10 collection");
      }
    };

    $scope.removeField = function (fields, field) {
      $scope.selectDone(field);
      fields.splice(this.$index, 1);
    };

    $scope.select = function (fields, field, index) {
      if ($scope.selectingFieldIndex !== null) {
        if ($scope.selectingFieldIndex !== index) {
          $scope.selectOk(fields[$scope.selectingFieldIndex]);
        } else {
          $scope.selectCancel(fields[$scope.selectingFieldIndex]);
        }
      }
      $scope.selectingFieldIndex = this.$index;
      field.selecting = true;
      field.selectingCustom = false;
      field.oldCss = field.selector;
      field.oldResults = field.results;
      this.enableSelectorGadget(field.selector, field.extract, field.attribute);
    };

    $scope.selectCustom = function (fields, field, index) {
      if ($scope.selectingFieldIndex !== null) {
        if ($scope.selectingFieldIndex !== index) {
          $scope.selectOk(fields[$scope.selectingFieldIndex]);
        }
      }
      $scope.selectingFieldIndex = index;
      field.selectingCustom = true;
      parent.postMessage(
        ["agenty_selectCustom", field.selector, field.extract, field.attribute],
        "*"
      );
    };

    $scope.selectOk = function (field) {
      field.resultsShown = false;
      this.selectDone(field);
    };

    $scope.selectCancel = function (field) {
      field.selector = field.oldCss;
      field.results = field.oldResults;
      this.selectDone(field);
    };

    $scope.selectDone = function (field) {
      $scope.selectingFieldIndex = null;
      field.selecting = false;
      field.selectingCustom = false;
      this.disableSelectorGadget();
    };

    $scope.changeDetectionSelect = function (field) {
      $scope.selectingFieldIndex = 10000;
      field.selecting = true;
      field.selectingCustom = false;
      field.oldCss = field.selector;
      field.oldResults = field.results;
      this.enableSelectorGadget(field.selector, field.extract, field.attribute);
    };

    $scope.changeDetectionCustomSelect = function (field) {
      $scope.selectingFieldIndex = 10000;
      field.selectingCustom = true;
      parent.postMessage(
        ["agenty_selectCustom", field.selector, field.extract, field.attribute],
        "*"
      );
    };

    $scope.add = function (array, value) {
      if (value && value !== "") {
        array.push(value);
      }
    };

    $scope.remove = function (array, index) {
      //var index = arr.indexOf(item);
      array.splice(index, 1);
    };

    $scope.showModal = function (modal) {
      $scope.nextModal = modal;
      $("#modal").modal("show");
      if (!$scope.user || !$scope.user.token) {
        $scope.modal = "login";
        return;
      }

      // Show loading
      $scope.modal = "loading";

      // Auth check
      $http
        .get(`${$scope.apiBaseURL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${$scope.user.token}`,
            "Content-Type": "application/json",
          },
        })
        .then(
          function (response) {
            $scope.modal = modal;
          },
          function (error) {
            $scope.modal = "login";
          }
        );
    };

    $scope.PreviewResult = function () {
      $scope.showModal("preview");
      $scope.results = [];

      angular.forEach($scope.agent.config.collections, function (collection) {
        var collectionResult = {
          collection: collection.name,
          json: convertToOutputFormat(collection.fields),
        };
        $scope.results.push(collectionResult);
      });
    };

    $scope.SaveAgent = function () {
      $scope.showModal("save");

      var d = new Date();
      var weekdays = new Array(7);
      weekdays[0] = "SUN";
      weekdays[1] = "MON";
      weekdays[2] = "TUE";
      weekdays[3] = "WED";
      weekdays[4] = "THU";
      weekdays[5] = "FRI";
      weekdays[6] = "SAT";

      var weekDay = weekdays[d.getDay()];

      $scope.scheduleOptions = [
        { text: "-", value: null, disabled: false, type: null },
        {
          text: "Every 5 minutes",
          value: "5m",
          disabled: true,
          type: "interval",
        },
        {
          text: "Every 15 minutes",
          value: "15m",
          disabled: true,
          type: "interval",
        },
        {
          text: "Every 30 minutes",
          value: "30m",
          disabled: false,
          type: "interval",
        },
        {
          text: "Every 45 minutes",
          value: "45m",
          disabled: false,
          type: "interval",
        },
        {
          text: "Every hour",
          value: "1h",
          disabled: false,
          type: "interval",
        },
        {
          text: "Every day",
          value: `${d.getMinutes()} ${d.getHours()} * * *`,
          disabled: false,
          type: "cron",
        },
        {
          text: "Every week",
          value: `${d.getMinutes()} ${d.getHours()} * * ${weekDay}`,
          disabled: false,
          type: "cron",
        },
        {
          text: "Every month",
          value: `${d.getMinutes()} ${d.getHours()} ${d.getDate()} * *`,
          disabled: false,
          type: "cron",
        },
      ];

      // Enable schedule option as per plan limit
      if ($scope.user) {
        const plans = [
          "FREE",
          "BASIC",
          "PROFESSIONAL",
          "BUSINESS",
          "ENTERPRISE",
        ];
        const index = plans.indexOf($scope.user.plan?.toUpperCase());
        $scope.scheduleOptions[1].disabled = index > 2 ? false : true;
        $scope.scheduleOptions[2].disabled = index > 1 ? false : true;
      }

      // Pre-select daily scheduler
      if ($scope.agent.type === "changedetection" && !$scope.agent.scheduler) {
        $scope.agent.scheduler = {
          type: "cron",
          expression: $scope.scheduleOptions[6].value,
        };
      }
    };

    $scope.LoginHandler = function (authUser, email) {
      $scope.loading.login = false;
      if (authUser.status?.toLowerCase() != "active") {
        $scope.handleError({
          message: `Account ${authUser.status}. <a target='_blank' href='https://agenty.com/pricing/'>Purchase a plan</a> to continue using Agenty`,
        });
      } else {
        $scope.handleSuccess({ message: "Logged in successfully" });
        $scope.user = authUser;
        $scope.email = email;
        store.set("authUser", authUser);
        store.set("authEmail", $scope.email);
        store.set("domain", $scope.domain);
        if ($scope.nextModal?.length > 0) {
          $scope.showModal($scope.nextModal);
        } else {
          $scope.GetAgents();
        }
      }
    };

    $scope.oauthGoogle = function () {
      chrome.runtime.sendMessage({ message: "oauthGoogle" });
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "login") {
          $scope.LoginHandler(request.data);
        }
      });
    };

    $scope.Login = function (login) {
      if ($scope.loginForm && !$scope.loginForm.$valid) {
        return;
      }

      $scope.loading.login = true;
      $http.post(`${$scope.apiBaseURL}/auth/signin`, login).then(
        function (response) {
          $scope.LoginHandler(response.data, login.email);
        },
        function (error) {
          $scope.handleError(error);
          $scope.loading.login = false;
        }
      );
    };

    $scope.LogOut = function () {
      $scope.user = null;
      store.remove("authUser");
      $scope.initSideBar();
      $scope.handleSuccess({ message: "Logout successfully" });
    };

    $scope.editAgent = function (agent) {
      $http
        .get(`${$scope.apiBaseURL}/agents/${agent.agent_id}`, {
          headers: {
            Authorization: `Bearer ${$scope.user.token}`,
            "Content-Type": "application/json",
          },
        })
        .then(
          function (response) {
            $scope.loadAgent(response.data);
          },
          function (error) {
            $scope.handleError(error);
          }
        );
    };

    $scope.loadAgent = function (agent) {
      $scope.panel = agent.type;
      $scope.agent = { ...agent };
      // Update fields result
      var timeoutTimer = 250;
      angular.forEach(agent.config.collections, function (collection) {
        $scope.selectedCollection = collection;
        angular.forEach(collection.fields, function (field, index) {
          $timeout(function () {
            $scope.selectCustom(collection.fields, field, index);
            // Auto accept last field after few seconds
            if (index === collection.fields.length - 1) {
              $scope.acceptAfterDelay(collection.fields);
            }
          }, timeoutTimer);
          timeoutTimer += 250;
        });
      });

      // Update changedetection result
      if (agent.type === "changedetection") {
        $scope.changeDetectionCustomSelect(agent.config);
        $timeout(function () {
          $scope.selectOk(agent.config);
        }, 250);
      }
    };

    $scope.acceptAfterDelay = function (fields) {
      $timeout(function () {
        if ($scope.selectingFieldIndex !== null) {
          $scope.selectOk({ ...fields[$scope.selectingFieldIndex] });
        }
      }, 250);
    };

    $scope.exportJSON = function (json) {
      var jsonString = JSON.stringify(json, undefined, 2);
      var element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/text;charset=utf-8," + escape(jsonString)
      );
      element.setAttribute("download", "result.txt");
      element.click();
    };

    $scope.exportCSV = function (json) {
      var element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/csv;charset=utf-8," + escape(JSON2CSV(json))
      );
      element.setAttribute("download", "result.csv");
      element.click();
    };

    $scope.exportTSV = function (json) {
      var element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/tsv;charset=utf-8," + escape(JSON2TSV(json))
      );
      element.setAttribute("download", "result.tsv");
      element.click();
    };

    $scope.GetAgents = function () {
      if (!$scope.user) return;

      $scope.loading.agents = true;
      $http
        .get(`${$scope.apiBaseURL}/agents`, {
          headers: {
            Authorization: `Bearer ${$scope.user.token}`,
            "Content-Type": "application/json",
          },
        })
        .then(
          function (response) {
            $scope.myAgents = response.data.result;
            $scope.loading.agents = false;
          },
          function (error) {
            $scope.loading.agents = false;
          }
        );
    };

    $scope.CreateAgent = function () {
      if ($scope.saveAgentForm && !$scope.saveAgentForm.$valid) {
        return;
      }

      // Add URL field
      if ($scope.agent.type === "scraping") {
        if (
          !$scope.agent.config.collections[0].fields.some(
            (x) => x.name == "url"
          )
        ) {
          $scope.agent.config.collections[0].fields.unshift({
            name: "url",
            type: "DEFAULT",
            from: "url",
          });
        }
      }

      $scope.loading.savingagent = true;
      $http
        .post(`${$scope.apiBaseURL}/agents`, $scope.agent, {
          headers: {
            Authorization: `Bearer ${$scope.user.token}`,
            "Content-Type": "application/json",
          },
        })
        .then(
          function (response) {
            const agent = response.data;
            $scope.success = {
              message: `Agent created successfully, see it here: <a target='_blank' href='${$scope.appBaseURL}/agents/${agent.type}/${agent.agent_id}'>#${agent.agent_id}</a>`,
            };
            if ($scope.agent.scheduler) {
              $scope.CreateSchedule(agent.agent_id, $scope.agent.scheduler);
            }
            if ($scope.autoStart) {
              $scope.startJob(agent.agent_id);
            }
            $scope.loading.savingagent = false;
            store.remove("agentDraft");
          },
          function (error) {
            $scope.handleError(error);
            $scope.loading.savingagent = false;
          }
        );
    };

    $scope.UpdateAgent = function () {
      if ($scope.saveAgentForm && !$scope.saveAgentForm.$valid) {
        return;
      }
      $scope.loading.savingagent = true;
      $http
        .put(
          `${$scope.apiBaseURL}/agents/${$scope.agent.agent_id}`,
          $scope.agent,
          {
            headers: {
              Authorization: `Bearer ${$scope.user.token}`,
              "Content-Type": "application/json",
            },
          }
        )
        .then(
          function (response) {
            $scope.success = {
              message: `Agent updated successfully, see it here: <a target='_blank' href='${$scope.appBaseURL}/agents/${$scope.agent.type}/${$scope.agent.agent_id}'>#${$scope.agent.agent_id}</a>`,
            };
            if ($scope.agent.scheduler) {
              $scope.CreateSchedule(
                $scope.agent.agent_id,
                $scope.agent.scheduler
              );
            }
            $scope.loading.savingagent = false;
            store.remove("agentDraft");
          },
          function (error) {
            $scope.handleError(error);
            $scope.loading.savingagent = false;
          }
        );
    };

    $scope.startJob = function (agentId) {
      $http
        .post(
          `${$scope.apiBaseURL}/jobs/start`,
          {
            agent_id: agentId,
          },
          {
            headers: {
              Authorization: `Bearer ${$scope.user.token}`,
              "Content-Type": "application/json",
            },
          }
        )
        .then(
          function (response) {},
          function (error) {
            $scope.handleError(error);
          }
        );
    };

    $scope.CreateSchedule = function (agentId, scheduler) {
      const match = $scope.scheduleOptions.find(
        (x) => x.value === scheduler.expression
      );
      if (match) {
        scheduler.type = match.type;
      }

      $http
        .post(`${$scope.apiBaseURL}/scheduler/${agentId}`, scheduler, {
          headers: {
            Authorization: `Bearer ${$scope.user.token}`,
            "Content-Type": "application/json",
          },
        })
        .then(
          function (response) {},
          function (error) {
            $scope.handleError(error);
          }
        );
    };

    var toastrConfig = {
      allowHtml: true,
      closeButton: true,
      positionClass: "toast-bottom-full-width",
    };

    $scope.handleSuccess = function (response) {
      toastr.success(response.message, "Success", toastrConfig);
    };

    $scope.handleError = function (error) {
      if (error.data) {
        if (error.data.details) {
          var errors = "";
          for (var prop in error.data.details) {
            errors +=
              "<li>Error: " + error.data.details[prop].error_message + " </li>";
          }
          toastr.error(
            "<p>" +
              error.data.message +
              "</p><p>Details : </p><ol>" +
              errors +
              "</ol>",
            "Error",
            toastrConfig
          );
        } else if (error.data.message) {
          toastr.error(error.data.message, "Error", toastrConfig);
        }
      } else if (error.message) {
        toastr.error(error.message, "Error", toastrConfig);
      } else {
        toastr.error(JSON.stringify(error), "Error", toastrConfig);
      }
    };

    // wrappers for communicating with parent window
    $scope.updateSourceURL = function () {
      parent.postMessage(["agenty_updateSourceURL"], "*");
    };

    $scope.toggleiFramefullWidth = function () {
      parent.postMessage(["agenty_toggleiFramefullWidth"], "*");
    };

    $scope.togglePosition = function () {
      parent.postMessage(["agenty_togglePosition"], "*");
    };

    $scope.disable = function () {
      if ($scope.panel !== "home" && $scope.panel !== "login") {
        $scope.panel = "home";
      } else {
        parent.postMessage(["agenty_disable"], "*");
      }
    };

    $scope.enableSelectorGadget = function (selector, extract, attribute) {
      parent.postMessage(
        ["agenty_enableSelectorGadget", selector, extract, attribute],
        "*"
      );
    };

    $scope.disableSelectorGadget = function () {
      parent.postMessage(["agenty_disableSelectorGadget"], "*");
    };

    $scope.updateLeafAndAttr = function (field) {
      parent.postMessage(
        ["agenty_updateLeafAndAttr", field.extract, field.attribute],
        "*"
      );
    };

    $scope.highlightResult = function (field, index) {
      parent.postMessage(["agenty_highlight", field.xpaths[index]], "*");
    };

    $scope.unhighlightResult = function () {
      parent.postMessage(["agenty_unhighlight"], "*");
    };

    // Listen for events from parent window
    window.addEventListener("message", function (e) {
      if (e.data[0] == "agenty_updateCssAndResults") {
        if (
          ($scope.agent.type === "scraping" ||
            $scope.agent.type === "crawling") &&
          $scope.selectingFieldIndex !== null &&
          $scope.selectedCollection != null
        ) {
          var fields = $scope.selectedCollection.fields;
          var field = fields[$scope.selectingFieldIndex];
          // prevent to modify field when typing
          if (!field.selectingCustom) {
            field.selector = e.data[1];
          }
          field.results = e.data[2];
          field.xpaths = e.data[3];
        } else if ($scope.agent.type == "changedetection") {
          var field = $scope.agent.config;
          if (!field.selectingCustom) {
            field.selector = e.data[1];
          }
          field.results = e.data[2];
          field.xpaths = e.data[3];
        }
        $scope.$digest();
      } else if (e.data[0] == "source_url") {
        var source = e.data[1];
        $scope.agent.config.url = source[0];
        $scope.agent.name = getDomain(source[0]);

        if (
          $scope.agent.type === "scraping" &&
          source[1] > 500 &&
          source[2] > 500
        ) {
          $scope.agent.config.viewport.width = source[1];
          $scope.agent.config.viewport.height = source[2];
        }
      }
    });
  }
);

app.directive("jsonText", function () {
  return {
    restrict: "A",
    require: "ngModel",
    link: function (scope, element, attr, ngModel) {
      function into(input) {
        return JSON.parse(input);
      }
      function out(data) {
        return JSON.stringify(data, undefined, 2);
      }
      ngModel.$parsers.push(into);
      ngModel.$formatters.push(out);
    },
  };
});

function convertToOutputFormat(fieldResults) {
  var jsonObj = fieldResults;
  var hasOtherValues = true;
  var index = 0;
  var outputJson = [];

  while (hasOtherValues && index < 5000) {
    hasOtherValues = false;

    var computedJsonValue = {};
    for (var i = 0; i < jsonObj.length; i++) {
      const field = jsonObj[i];
      if (field && field.results) {
        if (field.results[index]) {
          computedJsonValue[field.name] = field.results[index];
        } else {
          computedJsonValue[field.name] = "";
        }
        if (!hasOtherValues && !!field.results[index + 1]) {
          hasOtherValues = true;
        }
      }
    }
    outputJson.push(computedJsonValue);
    index++;
  }
  var trimJson = trimObj(outputJson);
  return trimJson;
}

function trimObj(obj) {
  if (!Array.isArray(obj) && typeof obj != "object") return obj;
  return Object.keys(obj).reduce(
    function (acc, key) {
      acc[key.trim()] =
        typeof obj[key] == "string" ? obj[key].trim() : trimObj(obj[key]);
      return acc;
    },
    Array.isArray(obj) ? [] : {}
  );
}

function getDomain(url) {
  try {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
      domain = url.split("/")[2];
    } else {
      domain = url.split("/")[0];
    }
    //find & remove port number
    domain = domain.split(":")[0];
    return domain.replace("www.", "");
  } catch (err) {
    return "Scraping agent";
  }
}

function JSON2CSV(objArray) {
  // http://jsfiddle.net/sturtevant/vunf9/

  var array = typeof objArray != "object" ? JSON.parse(objArray) : objArray;

  var str = "";
  var line = "";
  var hasHeading = true;
  var doubleQuoteString = true;

  if (hasHeading) {
    var head = array[0];
    if (doubleQuoteString) {
      for (var index in array[0]) {
        var value = index + "";
        line += '"' + value.replace(/"/g, '""') + '",';
      }
    } else {
      for (var index in array[0]) {
        line += index + ",";
      }
    }

    line = line.slice(0, -1);
    str += line + "\r\n";
  }

  for (var i = 0; i < array.length; i++) {
    var line = "";

    if (doubleQuoteString) {
      for (var index in array[i]) {
        var value = array[i][index] + "";
        line += '"' + value.replace(/"/g, '""') + '",';
      }
    } else {
      for (var index in array[i]) {
        line += array[i][index] + ",";
      }
    }

    line = line.slice(0, -1);
    str += line + "\r\n";
  }
  return str;
}

function JSON2TSV(objArray) {
  var array = typeof objArray != "object" ? JSON.parse(objArray) : objArray;

  var str = "";
  var line = "";
  var hasHeading = true;
  var doubleQuoteString = true;

  if (hasHeading) {
    var head = array[0];
    if (doubleQuoteString) {
      for (var index in array[0]) {
        var value = index + "";
        line += '"' + value.replace(/"/g, '""') + '"\t';
      }
    } else {
      for (var index in array[0]) {
        line += index + ",";
      }
    }

    line = line.slice(0, -1);
    str += line + "\r\n";
  }

  for (var i = 0; i < array.length; i++) {
    var line = "";

    if (doubleQuoteString) {
      for (var index in array[i]) {
        var value = array[i][index] + "";
        line += '"' + value.replace(/"/g, '""') + '"\t';
      }
    } else {
      for (var index in array[i]) {
        line += array[i][index] + ",";
      }
    }

    line = line.slice(0, -1);
    str += line + "\r\n";
  }
  return str;
}

function localStorageSupported() {
  if (typeof Storage) {
    var test = "test";
    try {
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  } else {
    return false;
  }
}
