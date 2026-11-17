
  export const fieldConfig = {
  // Critical Identification - Priority 100+
  file: { 
    label: 'File Path', 
    priority: 100, 
    group: 'Identification' 
  },
  image_format: { 
    label: 'Format', 
    priority: 99, 
    group: 'Identification' 
  },
  
  // Image Dimensions - Priority 90-99
  image_width: { 
    label: 'Width (px)', 
    priority: 95, 
    group: 'Image Properties' 
  },
  image_height: { 
    label: 'Height (px)', 
    priority: 94, 
    group: 'Image Properties' 
  },
  image_mode: { 
    label: 'Color Mode', 
    priority: 93, 
    group: 'Image Properties' 
  },
  file_size_bytes: { 
    label: 'File Size (bytes)', 
    priority: 92, 
    group: 'Image Properties' 
  },
  
  // Face Detection - Priority 80-89
  face_detection: { 
    label: 'Detection Confidence', 
    priority: 85, 
    group: 'Face Detection' 
  },
  face_ratio: { 
    label: 'Face/Image Ratio', 
    priority: 84, 
    group: 'Face Detection' 
  },
  face_left: { 
    label: 'Face Left (px)', 
    priority: 83, 
    group: 'Face Detection' 
  },
  face_top: { 
    label: 'Face Top (px)', 
    priority: 82, 
    group: 'Face Detection' 
  },
  face_right: { 
    label: 'Face Right (px)', 
    priority: 81, 
    group: 'Face Detection' 
  },
  face_bottom: { 
    label: 'Face Bottom (px)', 
    priority: 80, 
    group: 'Face Detection' 
  },
  
  // Head Boundaries - Priority 75-79
  head_left: { 
    label: 'Head Left (px)', 
    priority: 79, 
    group: 'Head Detection' 
  },
  head_top: { 
    label: 'Head Top (px)', 
    priority: 78, 
    group: 'Head Detection' 
  },
  head_right: { 
    label: 'Head Right (px)', 
    priority: 77, 
    group: 'Head Detection' 
  },
  head_bottom: { 
    label: 'Head Bottom (px)', 
    priority: 76, 
    group: 'Head Detection' 
  },
  
  // Facial Features - Priority 60-69
  ipd: { 
    label: 'Interpupillary Distance (px)', 
    priority: 65, 
    group: 'Facial Features' 
  },
  pupil_left_x: { 
    label: 'Left Pupil X', 
    priority: 64, 
    group: 'Facial Features' 
  },
  pupil_left_y: { 
    label: 'Left Pupil Y', 
    priority: 63, 
    group: 'Facial Features' 
  },
  pupil_right_x: { 
    label: 'Right Pupil X', 
    priority: 62, 
    group: 'Facial Features' 
  },
  pupil_right_y: { 
    label: 'Right Pupil Y', 
    priority: 61, 
    group: 'Facial Features' 
  },
  eye_closed_left: { 
    label: 'Left Eye Closed', 
    priority: 60, 
    group: 'Facial Features' 
  },
  eye_closed_right: { 
    label: 'Right Eye Closed', 
    priority: 59, 
    group: 'Facial Features' 
  },
  
  // Facial Attributes - Priority 50-59
  smile: { 
    label: 'Smile Detected', 
    priority: 55, 
    group: 'Facial Attributes' 
  },
  glasses: { 
    label: 'Glasses Detected', 
    priority: 54, 
    group: 'Facial Attributes' 
  },
  
  // Head Pose - Priority 40-49
  yaw_pose: { 
    label: 'Yaw Direction', 
    priority: 45, 
    group: 'Head Pose' 
  },
  yaw_degree: { 
    label: 'Yaw Angle (°)', 
    priority: 44, 
    group: 'Head Pose' 
  },
  pitch_pose: { 
    label: 'Pitch Direction', 
    priority: 43, 
    group: 'Head Pose' 
  },
  pitch_degree: { 
    label: 'Pitch Angle (°)', 
    priority: 42, 
    group: 'Head Pose' 
  },
  roll_pose: { 
    label: 'Roll Direction', 
    priority: 41, 
    group: 'Head Pose' 
  },
  roll_degree: { 
    label: 'Roll Angle (°)', 
    priority: 40, 
    group: 'Head Pose' 
  },
  
  // Image Quality Metrics - Priority 30-39
  brightness: { 
    label: 'Brightness', 
    priority: 35, 
    group: 'Image Quality' 
  },
  contrast: { 
    label: 'Contrast', 
    priority: 34, 
    group: 'Image Quality' 
  },
  sharpness: { 
    label: 'Sharpness', 
    priority: 33, 
    group: 'Image Quality' 
  },
  dynamic_range: { 
    label: 'Dynamic Range', 
    priority: 32, 
    group: 'Image Quality' 
  },
  // ============================================================================
// Quality Assessment - Priority 30–39 (Core quality signals)
// ============================================================================

    unified_quality_score: {
    label: 'Unified Quality Score',
    priority: 39,
    group: 'Quality Assessment'
    },
    unified_quality_score_scalar: {
    label: 'Unified Quality Score (Scalar)',
    priority: 38,
    group: 'Quality Assessment'
    },

    // ============================================================================
    // Illumination & Exposure - Priority 28–33
    // ============================================================================

    background_uniformity: {
    label: 'Background Uniformity',
    priority: 33,
    group: 'Illumination & Exposure',
    hide: true
    },
    background_uniformity_scalar: {
    label: 'Background Uniformity (Scalar)',
    priority: 32,
    group: 'Illumination & Exposure'
    },
    illumination_uniformity: {
    label: 'Illumination Uniformity',
    priority: 31,
    group: 'Illumination & Exposure',
    hide: true
    },
    illumination_uniformity_scalar: {
    label: 'Illumination Uniformity (Scalar)',
    priority: 30,
    group: 'Illumination & Exposure'
    },
    luminance_mean: {
    label: 'Luminance Mean',
    priority: 29,
    group: 'Illumination & Exposure',
    hide: true
    },
    luminance_mean_scalar: {
    label: 'Luminance Mean (Scalar)',
    priority: 28,
    group: 'Illumination & Exposure'
    },
    luminance_variance: {
    label: 'Luminance Variance',
    priority: 27,
    group: 'Illumination & Exposure',
    hide: true
    },
    luminance_variance_scalar: {
    label: 'Luminance Variance (Scalar)',
    priority: 26,
    group: 'Illumination & Exposure'
    },
    under_exposure_prevention: {
    label: 'Under Exposure Prevention',
    priority: 25,
    group: 'Illumination & Exposure',
    hide: true
    },
    under_exposure_prevention_scalar: {
    label: 'Under Exposure Prevention (Scalar)',
    priority: 24,
    group: 'Illumination & Exposure'
    },
    over_exposure_prevention: {
    label: 'Over Exposure Prevention',
    priority: 23,
    group: 'Illumination & Exposure',
    hide: true
    },
    over_exposure_prevention_scalar: {
    label: 'Over Exposure Prevention (Scalar)',
    priority: 22,
    group: 'Illumination & Exposure'
    },
    dynamic_range_scalar: {
    label: 'Dynamic Range (Scalar)',
    priority: 21,
    group: 'Illumination & Exposure'
    },

    // ============================================================================
    // Image Artefacts & Colour - Priority 20–24
    // ============================================================================

    compression_artifacts: {
    label: 'Compression Artifacts',
    priority: 24,
    group: 'Image Artefacts'
    },
    compression_artifacts_scalar: {
    label: 'Compression Artifacts (Scalar)',
    priority: 23,
    group: 'Image Artefacts'
    },
    natural_colour: {
    label: 'Natural Colour',
    priority: 22,
    group: 'Image Artefacts',
    hide: true
    },
    natural_colour_scalar: {
    label: 'Natural Colour (Scalar)',
    priority: 21,
    group: 'Image Artefacts',
    type: 'percent'
    },
    sharpness_scalar: {
    label: 'Sharpness (Scalar)',
    priority: 20,
    group: 'Image Artefacts'
    },

    // ============================================================================
    // Face Presence & Visibility - Priority 70–79
    // ============================================================================

    single_face_present: {
    label: 'Single Face Present',
    priority: 79,
    group: 'Face Validity',
    hide: true
    },
    single_face_present_scalar: {
    label: 'Single Face Present (Scalar)',
    priority: 78,
    group: 'Face Validity'
    },
    eyes_open: {
    label: 'Eyes Open',
    priority: 77,
    group: 'Face Validity',
    hide: true
    },
    eyes_open_scalar: {
    label: 'Eyes Open (Scalar)',
    priority: 76,
    group: 'Face Validity'
    },
    eyes_visible: {
    label: 'Eyes Visible',
    priority: 75,
    group: 'Face Validity',
    hide: true
    },
    eyes_visible_scalar: {
    label: 'Eyes Visible (Scalar)',
    priority: 74,
    group: 'Face Validity'
    },
    mouth_closed: {
    label: 'Mouth Closed',
    priority: 73,
    group: 'Face Validity',
    hide: true
    },
    mouth_closed_scalar: {
    label: 'Mouth Closed (Scalar)',
    priority: 72,
    group: 'Face Validity'
    },

    // ============================================================================
    // Occlusion & Coverings - Priority 65–69
    // ============================================================================

    mouth_occlusion_prevention: {
    label: 'Mouth Occlusion Prevention',
    priority: 69,
    group: 'Occlusion',
    hide: true
    },
    mouth_occlusion_prevention_scalar: {
    label: 'Mouth Occlusion Prevention (Scalar)',
    priority: 68,
    group: 'Occlusion'
    },
    face_occlusion_prevention: {
    label: 'Face Occlusion Prevention',
    priority: 67,
    group: 'Occlusion',
    hide: true
    },
    face_occlusion_prevention_scalar: {
    label: 'Face Occlusion Prevention (Scalar)',
    priority: 66,
    group: 'Occlusion'
    },
    no_head_coverings: {
    label: 'No Head Coverings',
    priority: 65,
    group: 'Occlusion',
    hide: true
    },
    no_head_coverings_scalar: {
    label: 'No Head Coverings (Scalar)',
    priority: 64,
    group: 'Occlusion'
    },

    // ============================================================================
    // Geometry & Framing - Priority 55–64
    // ============================================================================

    inter_eye_distance: {
    label: 'Inter-Eye Distance (px)',
    priority: 64,
    group: 'Geometry & Framing',
    hide: true
    },
    inter_eye_distance_scalar: {
    label: 'Inter-Eye Distance (Scalar)',
    priority: 63,
    group: 'Geometry & Framing'
    },
    head_size: {
    label: 'Head Size Ratio',
    priority: 62,
    group: 'Geometry & Framing',
    hide: true
    },
    head_size_scalar: {
    label: 'Head Size (Scalar)',
    priority: 61,
    group: 'Geometry & Framing'
    },
    leftward_crop_of_the_face_image: {
    label: 'Left Face Crop',
    priority: 60,
    group: 'Geometry & Framing',
    hide: true
    },
    leftward_crop_of_the_face_image_scalar: {
    label: 'Left Face Crop (Scalar)',
    priority: 59,
    group: 'Geometry & Framing'
    },
    rightward_crop_of_the_face_image: {
    label: 'Right Face Crop',
    priority: 58,
    group: 'Geometry & Framing',
    hide: true
    },
    rightward_crop_of_the_face_image_scalar: {
    label: 'Right Face Crop (Scalar)',
    priority: 57,
    group: 'Geometry & Framing'
    },
    margin_above_of_the_face_image: {
    label: 'Margin Above Face',
    priority: 56,
    group: 'Geometry & Framing',
    hide: true
    },
    margin_above_of_the_face_image_scalar: {
    label: 'Margin Above Face (Scalar)',
    priority: 55,
    group: 'Geometry & Framing'
    },
    margin_below_of_the_face_image: {
    label: 'Margin Below Face',
    priority: 54,
    group: 'Geometry & Framing',
    hide: true
    },
    margin_below_of_the_face_image_scalar: {
    label: 'Margin Below Face (Scalar)',
    priority: 53,
    group: 'Geometry & Framing'
    },

    // ============================================================================
    // Head Pose & Expression - Priority 45–54
    // ============================================================================

    head_pose_yaw: {
    label: 'Head Pose Yaw',
    priority: 54,
    group: 'Head Pose',
    hide: true
    },
    head_pose_yaw_scalar: {
    label: 'Head Pose Yaw (Scalar)',
    priority: 53,
    group: 'Head Pose'
    },
    head_pose_pitch: {
    label: 'Head Pose Pitch',
    priority: 52,
    group: 'Head Pose',
    hide: true
    },
    head_pose_pitch_scalar: {
    label: 'Head Pose Pitch (Scalar)',
    priority: 51,
    group: 'Head Pose'
    },
    head_pose_roll: {
    label: 'Head Pose Roll',
    priority: 50,
    group: 'Head Pose',
    hide: true
    },
    head_pose_roll_scalar: {
    label: 'Head Pose Roll (Scalar)',
    priority: 49,
    group: 'Head Pose'
    },
    expression_neutrality: {
    label: 'Expression Neutrality',
    priority: 48,
    group: 'Expression',
    hide: true
    },
    expression_neutrality_scalar: {
    label: 'Expression Neutrality (Scalar)',
    priority: 47,
    group: 'Expression'
    },

    //

    nfiq2_score: {
    label: 'NFIQ2 (Scalar)',
    priority: 99,
    group: 'Quality'
    },

    quantized: {
    label: 'Quantized',
    priority: 47,
    group: 'Image Quality'
    },

    resampled: {
        label: 'Resampled',
        priority: 47,
        group: 'Image Quality'
        },
    uniform_image: {
        label: 'Uniform',
        priority: 47,
        group: 'Image Quality'
        },
    empty_image_or_contrast_too_low: {
        label: 'Contrast',
        priority: 47,
        group: 'Image Quality'
        },
    fingerprint_image_with_minutiae: {
        label: 'Number of Minutea',
        priority: 47,
        group: 'Minutiae'
        },
    sufficient_fingerprint_foreground: {
        label: 'Foreground',
        priority: 47,
        group: 'Image Quality'
        },
    edge_std: {
        label: 'Corrupted',
        priority: 47,
        group: 'Corrupt'
        },

    

    // ============================================================================
    // Metadata
    // ============================================================================

    assessment_time_in_ms: {
    label: 'Assessment Time (ms)',
    priority: 10,
    group: 'System'
    }



};