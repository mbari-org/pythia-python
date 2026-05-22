class ModelServerFrontEnd {
   constructor({ form, submitButton, fileInput, hiddenError, previewImg, imagePane, svgDiv, successEl, predictionsEl,
      filename, filesize, filetype, downloadResults, clearImage, uploadHeading, htmlVideoTag, hiddenCanvas, videoPane, grabSnapshot, uploadHint }, a) {
      this._svgDiv = svgDiv;
      this._currentSvg = null;
      this._scaleDiff = 0;
      this._viewBox = null;
      this._data = null;

      this._form = form;
      this._formBlobData = null;

      this._submitButton = submitButton;
      this._fileInput = fileInput;
      this._hiddenError = hiddenError;
      this._previewImg = previewImg;
      this._imagePane = imagePane;
      this._successEl = successEl;
      this._predictionsEl = predictionsEl;
      this._filename = filename;
      this._filetype = filetype;
      this._filesize = filesize;
      this._downloadResults = downloadResults;
      this._clearImage = clearImage;
      this._uploadHeading = uploadHeading;
      this._videoPane = videoPane;
      this._htmlVideoTag = htmlVideoTag;
      this._grabSnapshot = grabSnapshot;

      this._hiddenCanvas = hiddenCanvas;
      this._uploadHint = uploadHint;

      this._acceptedImgTypes = ["apng", "avif", "jpeg", "gif", "png", "svg", "webp"];
      this._acceptedVideoTypes = ["mp4", "webm", "3gp", "mpeg", "quicktime", "ogg"];

      this._ctx = this._hiddenCanvas.getContext('2d');
      window.requestAnimationFrame(this.draw);


      this._downloadResults.addEventListener("click", this.downloadObjectAsJson.bind(this));
      this._submitButton.addEventListener("click", this.validateAndSubmit.bind(this));
      this._fileInput.addEventListener("change", this.validateAndPreview.bind(this));

      this._uploadHeading.addEventListener("click", (e) => {
         this._fileInput.click();
      });

      this._clearImage.addEventListener("click", this.clearAndRemoveFile.bind(this));

      this._grabSnapshot.addEventListener("click", this.downloadAnnotatedImage.bind(this));
   }

   draw = () => {
      this._ctx.drawImage(this._htmlVideoTag, 0, 0, this._hiddenCanvas.width, this._hiddenCanvas.height);
      window.requestAnimationFrame(this.draw);
   };

   validateAndSubmit = (e) => {
      e.preventDefault();
      const file = this._fileInput.files[0];
      const validation = this.validateFile(file);
      this._hiddenError.innerHTML = `${validation.message}`;
      if (validation.ok) {
         return this.postFile();
      }
   }

   clearAndRemoveFile() {
      this.clearFile();
      this._fileInput.value = "";
   }

   clearFile() {
      this.clearImageResults();
      this._formBlobData = null;

      this._clearImage.disabled = true;
      this._uploadHeading.classList.add('btn--emphasis');
      this._uploadHint.classList.remove('upload-hint--hidden');

      this._filename.innerHTML = "";
      this._filesize.innerHTML = "";
      this._filetype.innerHTML = "";

      this._htmlVideoTag.src = ""
      this._htmlVideoTag.type = "";

      this._videoPane.hidden = true;
      this._htmlVideoTag.hidden = false;

      this._grabSnapshot.disabled = true;
   }

   clearImageResults() {
      this._hiddenError.innerHTML = ``;
      this._predictionsEl.innerHTML = "";
      this._successEl.innerHTML = "";
      this._data = null;

      this._imagePane.hidden = true;
      this._previewImg.src = "";
      this._svgDiv.innerHTML = "";

      this._downloadResults.disabled = true;
      this._grabSnapshot.disabled = true;

      this._submitButton.disabled = true;
      this._hiddenError.innerHTML = ``;
   }

   preview = async (file) => {
      this.clearFile();

      if (file) {
         const mediaType = file.type.split("/")[0];
         const fileType = file.type.split("/")[1];
         const type = file.type.split("/")[0];

         if (mediaType == "image") {
            this._filename.innerHTML = file.name;
            this._filesize.innerHTML = file.size;
            this._filetype.innerHTML = file.type;

            this._formBlobData = file;

            this._previewImg.src = URL.createObjectURL(file);
            this._clearImage.disabled = false;
            this._uploadHeading.classList.remove('btn--emphasis');
            this._uploadHint.classList.add('upload-hint--hidden');
            this._submitButton.disabled = false;

            this._previewImg.onload = (e) => {
               this._imagePane.hidden = false;
               console.log("New preview loaded.....")
               this._viewBox = { width: this._previewImg.naturalWidth, height: this._previewImg.naturalHeight };
            }
         } else if (mediaType == "video") {
            this._filename.innerHTML = file.name;
            this._filesize.innerHTML = file.size;
            this._filetype.innerHTML = file.type;

            var url = URL.createObjectURL(new Blob([file]));
            this._htmlVideoTag.src = url;

            this._htmlVideoTag.onloadeddata = () => {
               console.log(this._htmlVideoTag.videoWidth);
               this._hiddenCanvas.width = this._htmlVideoTag.videoWidth;
               this._hiddenCanvas.height = this._htmlVideoTag.videoHeight;
               this._htmlVideoTag.type = file.type;
               this._clearImage.disabled = false;
               this._uploadHeading.classList.remove('btn--emphasis');
               this._uploadHint.classList.add('upload-hint--hidden');

               this._videoPane.hidden = false;
               console.log("New *video* loaded.....")
            }

         } else {
            this._hiddenError.innerHTML = `File must a valid <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img" target="_blank">image</a> or <a href="https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Video_codecs#common_codecs" target="_blank">video</a> type.`;
         }
      }

   }


   _previewFromSnapshotUrl = (imgURL) => {
      if (imgURL) {
         this._previewImg.src = imgURL;
         this._clearImage.disabled = false;
         this._uploadHeading.classList.remove('btn--emphasis');
         this._submitButton.disabled = false;

         this._previewImg.onload = (e) => {
            this._imagePane.hidden = false;
            console.log("New preview from snapshot loaded.....")
            this._viewBox = { width: this._previewImg.naturalWidth, height: this._previewImg.naturalHeight };
         }
      }
   }

   validateFile = (file) => {
      this._hiddenError.innerHTML = ``;
      if (file) {
         this._submitButton.disabled = false;
         return { ok: true, message: "" };
      } else {
         this._submitButton.disabled = true;
         this._hiddenError.innerHTML = `Error with file.`;
         return { ok: false, message: "Error with file" };
      }
   }

   toBlobCallback = (blob) => {
      const frameURL = URL.createObjectURL(blob);

      this._formBlobData = blob;

      console.log("Creating preview from video snapshot...")
      this._previewFromSnapshotUrl(frameURL);
   }

   downloadAnnotatedImage = async () => {
      const filename = this._filename.innerText || 'image';
      const lastDot = filename.lastIndexOf('.');
      const base = lastDot >= 0 ? filename.slice(0, lastDot) : filename;
      const ext  = lastDot >= 0 ? filename.slice(lastDot + 1) : 'png';
      const downloadName = `${base}-pythia.${ext}`;

      const canvas = document.createElement('canvas');
      canvas.width  = this._previewImg.naturalWidth;
      canvas.height = this._previewImg.naturalHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(this._previewImg, 0, 0);

      // Draw SVG overlay with text stripped out — SVG blob URLs load as a
      // separate document and cannot access page-loaded web fonts.
      const svgEl = this._svgDiv.querySelector('svg');
      if (svgEl) {
         const clone = svgEl.cloneNode(true);
         clone.setAttribute('width',  canvas.width);
         clone.setAttribute('height', canvas.height);
         clone.querySelectorAll('text').forEach(t => t.remove());

         const svgStr = new XMLSerializer().serializeToString(clone);
         const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
         const svgUrl = URL.createObjectURL(svgBlob);

         await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(svgUrl); resolve(); };
            img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(); };
            img.src = svgUrl;
         });
      }

      // Redraw labels via canvas 2D, which shares the page's loaded fonts.
      if (this._data && this._data.predictions) {
         const strokeWidth = Math.min(canvas.height, 1080) / 200;
         const fontSize    = Math.min(canvas.height, 1080) / 333 * 12;

         await document.fonts.ready;
         ctx.font         = `500 ${fontSize}px 'Hanken Grotesk', system-ui, sans-serif`;
         ctx.textBaseline = 'alphabetic';

         for (const prediction of this._data.predictions) {
            const boundingBox = Array.isArray(prediction.bbox)
               ? prediction.bbox : JSON.parse(prediction.bbox);

            const bx1 = Number(boundingBox[0]) + strokeWidth / 2;
            const by1 = Number(boundingBox[1]) + 2 * strokeWidth;
            const bx2 = Number(boundingBox[2]) + strokeWidth / 2;
            const by2 = Number(boundingBox[3]) + 2 * strokeWidth;
            const bw  = bx2 - bx1;
            const bh  = by2 - by1;

            const hash = [...prediction.category_id].reduce(
               (acc, ch) => ch.charCodeAt(0) + acc, 0);
            ctx.fillStyle = `hsla(${hash % 360}, 100%, 85%, 1)`;

            // Replicate labelXPosition (using natural image width)
            const charApproxWidth = fontSize / 4;
            const labelX = (prediction.category_id.length * charApproxWidth + bw) >= (canvas.width - bx1)
               ? Math.floor(-(prediction.category_id.length * charApproxWidth))
               : 0;

            // Place label just above the top edge; fall back to inside-top if near image edge
            const textY = (by1 - strokeWidth * 2) > fontSize
               ? by1 - strokeWidth * 2
               : by1 + fontSize + strokeWidth;

            ctx.fillText(prediction.category_id, bx1 + labelX, textY);
         }
      }

      const mimeType = ['jpg', 'jpeg'].includes(ext.toLowerCase()) ? 'image/jpeg' : 'image/png';
      canvas.toBlob((blob) => {
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = downloadName;
         document.body.appendChild(a);
         a.click();
         a.remove();
         URL.revokeObjectURL(url);
      }, mimeType);
   }

   postFile = () => {
      if (typeof this._formBlobData == "undefined" || this._formBlobData == null) {
         this._hiddenError.innerHTML = `Could not fetch predictions.`;
         return console.error('Null this._formBlobData.')
      }

      var myHeaders = new Headers();
      myHeaders.append("Accept", "*/*");
      myHeaders.append("Connection", "keep-alive");
      myHeaders.append("Access-Control-Request-Private-Network", "true");

      var formdata = new FormData();

      console.log(this._formBlobData);
      formdata.append("file", this._formBlobData);
      formdata.append("model_type", "image_queue_yolov5");

      var requestOptions = {
         method: 'POST',
         headers: myHeaders,
         body: formdata,
         redirect: 'follow',
         mode: 'cors'
      };

      this._successEl.innerHTML = "Loading....";
      fetch("/predictor", requestOptions)
         .then(response => response.json())
         .then(data => {
            console.log(data);
            this._hiddenError.innerHTML = ``;
            return this.handleData(data);
         })
         .catch(error => {
            console.error('Could not fetch predictions.', error)
            this._hiddenError.innerHTML = `Could not fetch predictions.`;
         });
   }


   handleResize = () => {
      if (this._data !== null) {
         this.handleData(this._data);
      }
   }

   handleData = (data) => {
      this._data = data;
      if (data.success !== null && data.success == true && data.predictions !== null) {
         this._successEl.innerHTML = data.predictions.length;
         this._downloadResults.disabled = false;
         this._grabSnapshot.disabled = false;
      } else {
         this._successEl.innerHTML = "Error";
         this._data = null;
         this._downloadResults.disabled = true;
         this._grabSnapshot.disabled = true;
      }
      if (data.predictions !== null) {
         this._predictionsEl.innerHTML = "";

         const viewBoxSize = `0 0 ${this._viewBox.width} ${this._viewBox.height}`;

         this._currentSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");


         this._currentSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
         this._currentSvg.setAttribute("viewBox", viewBoxSize);

         for (let prediction of data.predictions) {
            let predictionNode = document.createElement("li");
            this._predictionsEl.appendChild(predictionNode);

            const details = document.createElement("details");
            details.setAttribute("style", "padding-bottom: 15px;")
            predictionNode.appendChild(details);

            let categoryId = document.createElement("summary");
            categoryId.setAttribute("class", 'meta-box__link link');
            categoryId.setAttribute("style", "font-weight: 700");

            let scores = document.createElement("div");
            scores.setAttribute("style", "padding-left: 20px; color: rgb(109, 108, 144);");

            let bbox = document.createElement("div");
            bbox.setAttribute("style", "padding-left: 20px; color: rgb(109, 108, 144);");


            if (prediction.category_id !== null) {
               categoryId.textContent = `Category ID: ${prediction.category_id}`;
               details.appendChild(categoryId);
            }

            if (prediction.scores !== null) {
               scores.innerHTML = "<strong class='text-meta'>Score:</strong> ";
               for (let score of prediction.scores) {
                  scores.innerHTML += `<span style="">${score}<span>`;
               }
               details.appendChild(scores);
            }

            if (prediction.bbox !== null) {
               try {
                  details.appendChild(bbox);
                  this.showBoundingBoxes(bbox, prediction);
               } catch (err) {
                  console.log("Unable to draw bounding box.", err);
               }
            }


         }

         this._svgDiv.innerHTML = this._currentSvg.outerHTML;

         const listItems = [...this._predictionsEl.querySelectorAll('li')];
         const svgGroups = [...this._svgDiv.querySelectorAll('.concepts-figure__svg-group')];

         listItems.forEach((item, i) => {
            item.addEventListener('mouseenter', () => {
               svgGroups.forEach((g, j) => { g.style.opacity = i === j ? '1' : '0.15'; });
            });
            item.addEventListener('mouseleave', () => {
               svgGroups.forEach(g => { g.style.opacity = ''; });
            });
         });
      } else {
         this._predictionsEl.innerHTML = "N/A";
         this._downloadResults.disabled = true;
      }
   }

   showBoundingBoxes(bbox, prediction) {
      this._strokeWidth = Math.min(this._previewImg.naturalHeight, 1080) / 200;
      this._fontSize = Math.min(this._previewImg.naturalHeight, 1080) / 333 * 12;
      const strokeWidth = this._strokeWidth;
      const boundingBox = Array.isArray(prediction.bbox) ? prediction.bbox : JSON.parse(prediction.bbox);
      const bounding_x1 = Number(boundingBox[0]) + (strokeWidth / 2);
      const bounding_y1 = Number(boundingBox[1]) + (2 * strokeWidth);
      const bounding_x2 = Number(boundingBox[2]) + (strokeWidth / 2);
      const bounding_y2 = Number(boundingBox[3]) + (2 * strokeWidth);

      bbox.innerHTML = `<strong class='text-meta'>Bounding Boxes:</strong><br/><div class="label-1>`;
      bbox.innerHTML += ` &nbsp; <strong>x1</strong>: ${boundingBox[0]}<br/>`;
      bbox.innerHTML += ` &nbsp; <strong>y1</strong>: ${boundingBox[1]}<br/>`;
      bbox.innerHTML += ` &nbsp; <strong>x2</strong>: ${boundingBox[2]}<br/>`;
      bbox.innerHTML += ` &nbsp; <strong>y2</strong>: ${boundingBox[3]}</div>`;


      const bounding_width = bounding_x2 - bounding_x1;
      const bounding_height = bounding_y2 - bounding_y1;

      let hash = [...prediction.category_id].reduce((acc, char) => {
         return char.charCodeAt(0) + acc;
      }, 0);
      const colorHash = hash % 360;
      const colorString = `hsla(${colorHash}, 100%, 85%, 1)`;

      const box_G = document.createElement("g");
      box_G.setAttribute("id", `${String(prediction.category_id).replace(" ", "-")}__${bounding_x1}__${bounding_x1}`);
      box_G.setAttribute("style", `color: ${colorString}; stroke: ${colorString}; stroke-width: ${strokeWidth}px;`);
      box_G.setAttribute("x", `${bounding_x1}`);
      box_G.setAttribute("y", `${bounding_y1}`);
      box_G.setAttribute("transform", `translate(${bounding_x1}, ${bounding_y1})`);
      box_G.setAttribute("class", `concepts-figure__svg-group`);
      box_G.setAttribute("active", `true`);
      box_G.setAttribute("ref", `group`);
      this._currentSvg.appendChild(box_G);


      const concept_Text = document.createElement("text");
      concept_Text.setAttribute("style", `fill: ${colorString}; transform: translateY(1.25em); font-size: ${this._fontSize}px;`)
      concept_Text.setAttribute("stroke", `none`);
      concept_Text.setAttribute("fill", colorString);
      let labelX = this.labelXPosition(prediction.category_id.length, bounding_width, bounding_x1);
      concept_Text.setAttribute("x", labelX);
      let labelY = this.labelYPosition(bounding_height, bounding_y1);
      concept_Text.setAttribute("y", labelY);
      concept_Text.setAttribute("class", `concepts-figure__svg-text`);
      concept_Text.innerText = prediction.category_id;
      box_G.appendChild(concept_Text);


      const box_path = document.createElement("path");
      box_path.setAttribute("stroke", colorString);
      box_path.setAttribute("stroke-width", `${strokeWidth}px`);
      box_path.setAttribute("fill", "transparent");
      box_path.setAttribute("class", "concepts-figure__svg-shape");
      box_path.setAttribute("d", `m 0 0
                        h ${Math.floor(bounding_width)}
                        v ${Math.floor(bounding_height)}
                        h ${-Math.floor(bounding_width)}
                        z`);
      box_G.appendChild(box_path);
   }

   labelXPosition = (conceptLength, bounding_width, bounding_x) => {
      let labelHeight = this._fontSize;
      let conceptLengthSM = conceptLength * (labelHeight / 4);
      let conceptLengthLG = conceptLengthSM + (bounding_width);
      let space = (this._previewImg.width - bounding_x);

      if (conceptLengthLG >= space) {
         return Math.floor(-(conceptLengthSM));
      } else {
         return 0;
      }
   }

   labelYPosition = (bounding_height, bounding_y) => {
      let labelHeight = this._fontSize;
      let actualHeightNeeded = labelHeight + bounding_height;
      let needsMoreSpace = (bounding_y + actualHeightNeeded) > this._previewImg.height;

      if (needsMoreSpace) {
         return Math.floor(-(labelHeight + (this._strokeWidth * 4)));
      } else {
         return Math.floor(0 + (bounding_height - (this._strokeWidth * 4)));
      }
   }

   validateAndPreview = () => {
      const file = this._fileInput.files[0];

      this.validateFile(file);
      this.preview(file);
   }

   downloadObjectAsJson() {
      const exportObj = this._data;
      let date = new Date().toISOString();
      const exportName = `Results__${String(this._filename.innerText).split(".")[0]}__${date}`
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
      const downloadAnchorNode = document.createElement('a');

      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", exportName + ".json");
      document.body.appendChild(downloadAnchorNode);

      downloadAnchorNode.click();
      downloadAnchorNode.remove();
   }
}
